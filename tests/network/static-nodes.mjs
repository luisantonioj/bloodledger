import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const repositoryRoot = new URL("../../", import.meta.url);
const environment = {
  ...process.env,
  MEDIATRIX_CA_ADMIN_PASSWORD: "static-validation-only",
  ORDERER_CA_ADMIN_PASSWORD: "static-validation-only",
  POSTGRES_ADMIN_PASSWORD: "static-validation-only",
  POSTGRES_MIGRATOR_PASSWORD: "static-validation-only",
  POSTGRES_APP_PASSWORD: "static-validation-only",
};
const suppliedComposeJson = process.env.BLOODLEDGER_EFFECTIVE_COMPOSE_JSON;
const effective = JSON.parse(suppliedComposeJson
  ? readFileSync(suppliedComposeJson, "utf8")
  : execFileSync(
      "docker",
      ["compose", "--project-name", "bloodledger", "config", "--format", "json"],
      { cwd: repositoryRoot, encoding: "utf8", env: environment },
    ));

const peer = effective.services["peer0-mediatrix"];
const orderer = effective.services.orderer0;
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};
const publishedPorts = (service) => service.ports ?? [];
const mount = (service, target) =>
  service.volumes.find((entry) => entry.target === target);

assert(peer.image === "hyperledger/fabric-peer:2.5.16", "peer image is not pinned to Fabric 2.5.16");
assert(orderer.image === "hyperledger/fabric-orderer:2.5.16", "orderer image is not pinned to Fabric 2.5.16");
assert(!peer.container_name && !orderer.container_name, "fixed node container_name is prohibited");
assert(peer.environment.CORE_PEER_ID === "peer0.mediatrix.bloodledger.local", "peer logical ID mismatch");
assert(peer.environment.CORE_PEER_LOCALMSPID === "MediatrixMSP", "peer MSP ID mismatch");
assert(peer.environment.CORE_LEDGER_STATE_STATEDATABASE === "goleveldb", "peer must use LevelDB");
assert(peer.environment.CORE_PEER_TLS_ENABLED === "true", "peer network TLS must be enabled");
assert(peer.environment.CORE_OPERATIONS_LISTENADDRESS === "0.0.0.0:9443", "peer operations endpoint mismatch");
assert(peer.environment.CORE_OPERATIONS_TLS_ENABLED === "false", "peer operations TLS exception mismatch");
assert(peer.command?.join(" ") === "peer node start", "peer command must start the node");
assert(peer.environment.CORE_VM_ENDPOINT === "unix:///var/run/docker.sock", "peer Docker builder endpoint mismatch");
assert(peer.environment.CORE_VM_DOCKER_HOSTCONFIG_NETWORKMODE === "bloodledger_default", "chaincode network must be project-scoped");
assert(peer.environment.CORE_CHAINCODE_NODE_RUNTIME === "hyperledger/fabric-nodeenv@sha256:17e2d447ca0de5b4e3f6950a1c9b24ecfdeecdd90e111e11d771970d35159bf1", "Node chaincode runtime image must be digest-pinned");
assert(peer.environment.CORE_CHAINCODE_PULL === "false", "chaincode builder must not pull a floating image");
const dockerSocket = mount(peer, "/var/run/docker.sock");
assert(dockerSocket?.type === "bind" && dockerSocket.source === "/var/run/docker.sock", "peer Docker builder socket mismatch");
assert(orderer.environment.ORDERER_GENERAL_LOCALMSPID === "OrdererMSP", "orderer MSP ID mismatch");
assert(orderer.environment.ORDERER_GENERAL_BOOTSTRAPMETHOD === "none", "orderer bootstrap method mismatch");
assert(orderer.environment.ORDERER_CHANNELPARTICIPATION_ENABLED === "true", "channel participation must be enabled");
assert(orderer.environment.ORDERER_GENERAL_TLS_ENABLED === "true", "orderer network TLS must be enabled");
assert(orderer.environment.ORDERER_OPERATIONS_LISTENADDRESS === "0.0.0.0:8443", "orderer operations endpoint mismatch");
assert(orderer.environment.ORDERER_OPERATIONS_TLS_ENABLED === "false", "orderer operations TLS exception mismatch");
assert(orderer.environment.ORDERER_ADMIN_TLS_ENABLED === "true", "orderer admin endpoint must use mutual TLS");

const isOnlyLoopbackPort = (service, target) => {
  const ports = publishedPorts(service);
  return ports.length === 1 && ports[0].target === target &&
    ports[0].published === String(target) && ports[0].host_ip === "127.0.0.1";
};
assert(isOnlyLoopbackPort(peer, 7051), "peer publishes an unapproved port");
assert(isOnlyLoopbackPort(orderer, 7050), "orderer publishes an unapproved port");

for (const [service, targets] of [[peer, ["/opt/bloodledger/fabric/msp", "/opt/bloodledger/fabric/tls"]], [orderer, ["/opt/bloodledger/orderer/msp", "/opt/bloodledger/orderer/tls"]]]) {
  for (const target of targets) {
    const entry = mount(service, target);
    assert(entry?.type === "bind" && entry.read_only === true, `generated identity mount must be a read-only bind: ${target}`);
    const normalizedSource = entry.source.replaceAll("\\", "/");
    assert(normalizedSource.includes("/network/generated/organizations/"), `identity mount escapes generated boundary: ${target}`);
  }
}
for (const [service, targets] of [
  [peer, [["/etc/hyperledger/fabric", "peer0-mediatrix-config"], ["/var/hyperledger", "peer0-mediatrix-data"]]],
  [orderer, [["/etc/hyperledger/fabric", "orderer0-config"], ["/var/hyperledger", "orderer0-data"]]],
]) {
  for (const [target, source] of targets) {
    const entry = mount(service, target);
    assert(entry?.type === "volume" && entry.source === source, `node runtime volume must be project-scoped: ${target}`);
  }
}
assert(peer.healthcheck?.test?.join(" ").includes("/healthz"), "peer health check must use /healthz");
assert(orderer.healthcheck?.test?.join(" ").includes("/healthz"), "orderer health check must use /healthz");

const serviceNames = Object.keys(effective.services);
assert(serviceNames.filter((name) => name === "peer0-mediatrix").length === 1, "expected exactly one peer service");
assert(serviceNames.filter((name) => name === "orderer0").length === 1, "expected exactly one orderer service");
assert(!serviceNames.some((name) => /couchdb/i.test(name)), "CouchDB is outside the approved topology");

const wording = `${readFileSync(new URL("../../network/README.md", import.meta.url), "utf8")}\n${readFileSync(new URL("../../docs/ARCHITECTURE.md", import.meta.url), "utf8")}`;
for (const phrase of ["single-operational-member", "development", "not a second operational hospital member"]) {
  assert(wording.includes(phrase), `missing required topology wording: ${phrase}`);
}

console.log("Static Fabric peer/orderer configuration checks passed");
