"""Shared crop pixel test; generated test pixels are not corpus photographs."""
import hashlib
import json
import tempfile
import unittest
from pathlib import Path
from PIL import Image
from field_crops import crop_field, export_crops, PILLOW_VERSION
import PIL


class CropTests(unittest.TestCase):
    def test_identical_export_pixels_and_bounds(self):
        self.assertEqual(PIL.__version__, PILLOW_VERSION)
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp);image=Image.new('RGB',(20,20),(0,100,200));image.save(root/'test.png')
            evidence={'value':'CANONICAL','rawText':'RAW','state':'present','precision':'UNKNOWN','bbox':[2,3,12,13]}
            fields={f:dict(evidence) for f in ('donationNumber','bloodType','componentType','collectedAt','expiresAt')}
            m={'schemaVersion':'SYNTHETIC_LABEL_CORPUS_V1','classification':'SIMULATION_ONLY','datasetVersion':'PIXEL_UNIT_TEST_ONLY',
               'labels':[{'labelId':'TEST','bank':'MEDIATRIX','style':'printed','split':'validation','groundTruthStatus':'REVIEWED','reviewers':['TEST_A','TEST_B']}],
               'images':[{'imageId':'TEST_IMAGE','labelId':'TEST','path':'test.png','sha256':hashlib.sha256((root/'test.png').read_bytes()).hexdigest(),'captured':True,'reviewers':['TEST_A','TEST_B'],'fields':fields}]}
            (root/'manifest.json').write_text(json.dumps(m))
            result=export_crops(root/'manifest.json',root/'crops','validation')
            entry=result['images'][0]['crops']['donationNumber']
            expected=crop_field(image,evidence)
            self.assertEqual(expected.size,(10,10))
            self.assertEqual(entry['pixelSha256'],hashlib.sha256(expected.tobytes()).hexdigest())
            with Image.open(root/'crops'/entry['path']) as exported:
                self.assertEqual(exported.tobytes(),expected.tobytes())
            self.assertEqual(entry['sha256'],hashlib.sha256((root/'crops'/entry['path']).read_bytes()).hexdigest())
            with self.assertRaisesRegex(ValueError,'bounds'):
                crop_field(image,{**evidence,'bbox':[0,0,21,20]})
            with self.assertRaises(FileExistsError):
                export_crops(root/'manifest.json',root/'crops','validation')

    def test_uncollected_corpus_blocks_before_loading_image(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp)
            m={'schemaVersion':'SYNTHETIC_LABEL_CORPUS_V1','classification':'SIMULATION_ONLY','labels':[{'labelId':'TEST','bank':'MEDIATRIX','style':'printed','split':'validation'}], 'images':[{'imageId':'TEST','labelId':'TEST','captured':False}]}
            (root/'manifest.json').write_text(json.dumps(m))
            with self.assertRaisesRegex(ValueError,'Uncollected'):
                export_crops(root/'manifest.json',root/'crops','validation')
            self.assertFalse((root/'crops').exists())


if __name__=='__main__':unittest.main()
