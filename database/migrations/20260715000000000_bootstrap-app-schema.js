exports.up = (pgm) => {
  pgm.createSchema("app", { authorization: "bloodledger_migrator" });
  pgm.sql("REVOKE ALL ON SCHEMA app FROM PUBLIC");
  pgm.sql("GRANT USAGE ON SCHEMA app TO bloodledger_app");
};

exports.down = false;

