import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

spec=importlib.util.spec_from_file_location("ocr_experiment",Path(__file__).with_name("experiment.py"))
experiment=importlib.util.module_from_spec(spec);spec.loader.exec_module(experiment)

class OcrExperimentTests(unittest.TestCase):
    def test_plan_counts_writer_isolation_and_no_fake_photos(self):
        with tempfile.TemporaryDirectory() as root:
            result=experiment.create_plan(Path(root)/"corpus")
            self.assertEqual((result["labels"],result["plannedPhotographs"],result["collectedPhotographs"]),(180,540,0))
            manifest=json.loads((Path(root)/"corpus/manifest.json").read_text())
            experiment.validate_manifest(manifest,Path(root)/"corpus")
            for bank in experiment.BANKS:
                labels=[row for row in manifest["labels"] if row["bank"]==bank]
                self.assertEqual({split:sum(row["split"]==split for row in labels) for split in ("train","validation","test")},{"train":36,"validation":12,"test":12})
                self.assertEqual(len({(row["values"]["bloodType"],row["values"]["componentType"]) for row in labels}),40)
                for split in ("train","validation","test"):
                    split_labels=[row for row in labels if row["split"]==split]
                    self.assertEqual(len({row["values"]["bloodType"] for row in split_labels}),8)
                    self.assertEqual(len({row["values"]["componentType"] for row in split_labels}),5)
            with self.assertRaisesRegex(ValueError,"Uncollected"):
                experiment.validate_manifest(manifest,Path(root)/"corpus",True)
            handwritten=[row for row in manifest["labels"] if row["style"]=="handwritten"]
            handwritten[-1]["writerId"]=handwritten[0]["writerId"]
            with self.assertRaisesRegex(ValueError,"Writer leakage"):
                experiment.validate_manifest(manifest,Path(root)/"corpus")
    def test_missing_predictions_are_failures_and_unresolved_eligible_is_counted(self):
        with tempfile.TemporaryDirectory() as folder:
            base=Path(folder);labels=[];images=[];predictions=[]
            for ordinal,bank in enumerate(experiment.BANKS):
                label_id="SYN_TEST_"+bank
                labels.append({"labelId":label_id,"bank":bank,"style":"printed","split":"validation","groundTruthStatus":"REVIEWED","reviewers":["REVIEWER_A","REVIEWER_B"]})
                path=base/(label_id+".png");path.write_bytes(("synthetic-unit-test-bytes-"+bank).encode())
                fields={name:{"value":"SYNTHETIC", "state":"present", "precision":"UNKNOWN", "bbox":[0,0,10,10]} for name in experiment.FIELDS}
                if ordinal==0:fields["expiresAt"]={"value":None,"state":"ambiguous","precision":"AMBIGUOUS","bbox":None}
                images.append({"imageId":label_id,"labelId":label_id,"path":path.name,"sha256":experiment.hashlib.sha256(path.read_bytes()).hexdigest(),"captured":True,"reviewers":["REVIEWER_A","REVIEWER_B"],"fields":fields})
                if ordinal!=2:predictions.append({"imageId":label_id,"candidateId":"UNIT_TEST_ONLY","fields":{name:{"candidate":None if ordinal==0 and name=="expiresAt" else "SYNTHETIC","reviewState":"needs review","eligibleForSubmission":ordinal==0 and name=="expiresAt"} for name in experiment.FIELDS},"latencyMs":1})
            manifest={"schemaVersion":"SYNTHETIC_LABEL_CORPUS_V1","classification":"SIMULATION_ONLY","datasetVersion":"UNIT_TEST_ONLY","labels":labels,"images":images}
            report=experiment.score(manifest,predictions,"validation","UNIT_TEST_ONLY",base)
            self.assertEqual(report["missingPredictions"],1)
            self.assertEqual(report["perBank"]["NLVILLA"]["completeExact"],0)
            expiry=next(row for row in report["metrics"] if row["bank"]=="MEDIATRIX" and row["style"]=="printed" and row["field"]=="expiresAt")
            self.assertEqual(expiry["incorrectEligible"],1)
            self.assertEqual(expiry["unresolvedDetected"],1)
            self.assertFalse(report["realLabelValidated"])
            self.assertIsNone(report["candidateFingerprint"])
            for prediction in predictions:prediction.update(codeArtifactHash="UNIT_TEST_CODE",engineAssetsHash="UNIT_TEST_ASSETS",configuration={"seed":1})
            pinned=experiment.score(manifest,predictions,"validation","UNIT_TEST_ONLY",base)
            self.assertIsNotNone(pinned["candidateFingerprint"])
            predictions[0]["codeArtifactHash"]="CHANGED_UNIT_TEST_CODE"
            with self.assertRaisesRegex(ValueError,"changed within a run"):experiment.score(manifest,predictions,"validation","UNIT_TEST_ONLY",base)
            predictions[0]["codeArtifactHash"]="UNIT_TEST_CODE"
            predictions.append(predictions[0])
            with self.assertRaisesRegex(ValueError,"Duplicate prediction"):experiment.score(manifest,predictions,"validation","UNIT_TEST_ONLY",base)

    def test_edit_distance(self):
        self.assertEqual(experiment.edit_distance("MM26-10-7001","MM26-10-700I"),1)
        self.assertEqual(experiment.edit_distance("ABC",""),3)
    def test_no_overwrite(self):
        with tempfile.TemporaryDirectory() as root:
            output=Path(root)/"result.json"
            experiment.write_new(output,{"a":1})
            with self.assertRaises(FileExistsError):experiment.write_new(output,{"a":2})

if __name__=="__main__":unittest.main()
