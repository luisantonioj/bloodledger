"""Synthetic tooling regressions only; not recognition accuracy evidence."""
import copy
import hashlib
import importlib.util
import json
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
import experiment as e
from plan_v3 import create_plan_v3, frozen_contract, PINNED, profile_hash, NEGATIVES
from reporting import aligned_metrics, latency_summary


class AlignmentTests(unittest.TestCase):
    def test_v2_unchanged_and_v3_reproducible_private_stamped(self):
        with tempfile.TemporaryDirectory() as tmp:
            base = Path(tmp)
            e.create_plan(base/'v2')
            self.assertEqual(hashlib.sha256((base/'v2/manifest.json').read_bytes()).hexdigest(), 'd4df9d999aa8774eb5ad25cae8561c1140aadc2e2ac36364d4c1e8ce86cf72d4')
            for name in ('v3a', 'v3b'):
                create_plan_v3(base/name, e.private_output, e.write_new)
            self.assertEqual((base/'v3a/manifest.json').read_bytes(), (base/'v3b/manifest.json').read_bytes())
            m = json.loads((base/'v3a/manifest.json').read_text())
            e.validate_manifest(m, base/'v3a')
            self.assertEqual((len(m['labels']), len(m['images'])), (243, 729))
            self.assertEqual(sum(not l['negativeClass'] for l in m['labels']), 180)
            self.assertEqual(set(l['negativeClass'] for l in m['labels'] if l['negativeClass']), set(NEGATIVES))
            for bank in e.BANKS:
                for split, count in [('train',36),('validation',12),('test',12)]:
                    rows=[l for l in m['labels'] if l['bank']==bank and l['split']==split and not l['negativeClass']]
                    self.assertEqual(len(rows),count)
                    self.assertEqual(sum(l['style']=='printed' for l in rows),count//2)
            self.assertTrue(all(i['fields']['donationNumber']['state'] is None for i in m['images']))
            self.assertTrue(all(not i['captured'] and not i['reviewers'] for i in m['images']))
            self.assertEqual(os.stat(base/'v3a').st_mode & 0o777, 0o700)
            self.assertTrue(all(p.stat().st_mode & 0o777 == 0o600 for p in (base/'v3a').iterdir()))
            with self.assertRaisesRegex(ValueError, 'Uncollected'):
                e.validate_manifest(m, base/'v3a', True)
            m['labels'][0]['profileSha256']='0'*64
            with self.assertRaisesRegex(ValueError, 'profile stamp'):
                e.validate_manifest(m, base/'v3a')

    def test_v4_coverage_varied_dates_and_v3_hash(self):
        with tempfile.TemporaryDirectory() as tmp:
            base = Path(tmp)
            create_plan_v3(base/'v3', e.private_output, e.write_new)
            self.assertEqual(hashlib.sha256((base/'v3/manifest.json').read_bytes()).hexdigest(), '6cb42444456c5e39a938682b7b85715ff9bdaffaa6461786d1d8a62b842a839f')
            for name in ('v4a', 'v4b'):
                create_plan_v3(base/name, e.private_output, e.write_new, version='v4')
            self.assertEqual((base/'v4a/manifest.json').read_bytes(), (base/'v4b/manifest.json').read_bytes())
            m = json.loads((base/'v4a/manifest.json').read_text())
            e.validate_manifest(m, base/'v4a')
            self.assertEqual(m['datasetVersion'], 'OCR_PILOT_PLAN_V4')
            for bank in e.BANKS:
                for split in ('train', 'validation', 'test'):
                    for style in ('printed', 'handwritten'):
                        rows = [l for l in m['labels'] if l['bank']==bank and l['split']==split and l['style']==style and not l['negativeClass']]
                        self.assertEqual(sum(l['datePrecision']=='DATE' for l in rows), 1)
                        self.assertGreater(len({l['values']['expiresAt'] for l in rows}), 1)
            target = next(l for l in m['labels'] if l['split']=='test' and l['datePrecision']=='DATE')
            target['datePrecision']='INSTANT'
            with self.assertRaisesRegex(ValueError, 'both date precisions'):
                e.validate_manifest(m, base/'v4a')

    def test_whole_label_nonpresent_states_and_failed_attempts(self):
        with tempfile.TemporaryDirectory() as tmp:
            for state in ('absent', 'obscured', 'unreadable', 'ambiguous'):
                m,p = self.fixture(Path(tmp))
                for image, prediction in zip(m['images'], p):
                    image['fields']['componentType'].update(state=state, value=None, rawText=None)
                    prediction['fields']['componentType']={'state':state, 'candidate':None}
                def result():
                    return aligned_metrics(m['images'], {l['labelId']:l for l in m['labels']}, {r['imageId']:r for r in p}, e.FIELDS)['allThreePhotosPerLabel']['MEDIATRIX/printed']['allThreeExact']
                self.assertEqual(result(), 1)
                p[0]['fields']['componentType']['state']='present'
                self.assertEqual(result(), 0)
                p[0]['fields']['componentType']['state']=state
                p[0]['safeErrorCode']='TEST_FAILED'
                self.assertEqual(result(), 0)
                p.pop(0)
                self.assertEqual(result(), 0)

    def test_profiles_render_headings_order_placement_and_closed_values(self):
        contract=frozen_contract()
        self.assertEqual({p['id']:profile_hash(contract,p) for p in contract['profiles']}, PINNED)
        with tempfile.TemporaryDirectory() as tmp:
            base=Path(tmp)/'v3';create_plan_v3(base,e.private_output,e.write_new)
            m=json.loads((base/'manifest.json').read_text())
            for profile in contract['profiles']:
                label=next(l for l in m['labels'] if l['bank']==profile['bankCode'] and not l['negativeClass'] and l['style']=='printed')
                svg=(base/(label['labelId']+'.svg')).read_text()
                self.assertIn(contract['marker'],svg);self.assertIn(profile['bankLine'],svg)
                self.assertIn(contract['timeCaption'],svg)
                positions=[svg.index(f['heading']+':') for f in profile['fields']]
                self.assertEqual(positions,sorted(positions))
                self.assertIn(label['printedValues']['bloodType'],contract['bloodTypeForms'])
                self.assertIn(label['printedValues']['componentType'],contract['componentForms'])
                self.assertEqual(label['datePrecision'],'DATE')
                self.assertEqual(label['values']['collectedAt'],'2026-10-01')
            instant=next(l for l in m['labels'] if not l['negativeClass'] and l['datePrecision']=='INSTANT')
            self.assertEqual(instant['values']['collectedAt'],'2026-10-01T00:00:00.000Z')
            handwritten=next(l for l in m['labels'] if l['style']=='handwritten')
            svg=(base/(handwritten['labelId']+'.svg')).read_text()
            self.assertNotIn(handwritten['values']['donationNumber'],svg)
            self.assertIn('________________',svg)

    def test_donation_leakage_and_nonfinite_boxes_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            base=Path(tmp)/'v3';create_plan_v3(base,e.private_output,e.write_new)
            m=json.loads((base/'manifest.json').read_text())
            a=m['labels'][0];b=next(l for l in m['labels'] if l['split']=='test')
            b['donationRelationshipId']=a['donationRelationshipId']
            with self.assertRaisesRegex(ValueError,'Donation relationship'):
                e.validate_manifest(m,base)
        self.assertFalse(e.valid_box([0,0,float('inf'),4]))
        self.assertFalse(e.valid_box([False,0,4,4]))

    def fixture(self, base):
        labels=[];images=[];predictions=[]
        for bank in e.BANKS:
            label={'labelId':bank,'bank':bank,'style':'printed','split':'validation','groundTruthStatus':'REVIEWED','reviewers':['TEST_REVIEW_A','TEST_REVIEW_B']}
            labels.append(label)
            for n,condition in enumerate(('clear','angled_curved','challenging_lighting')):
                ident=bank+'_'+condition;path=base/(ident+'.bin');path.write_bytes(ident.encode())
                fields={f:{'value':'CANONICAL','rawText':'raw','state':'present','precision':'UNKNOWN','bbox':[0,0,10,10]} for f in e.FIELDS}
                images.append({'imageId':ident,'labelId':bank,'condition':condition,'path':path.name,'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'captured':True,'reviewers':['TEST_REVIEW_A','TEST_REVIEW_B'],'fields':fields})
                predictions.append({'imageId':ident,'candidateId':'UNIT_TEST','candidateBoundary':'END_TO_END_EXTRACTION','codeArtifactHash':'test-code','engineAssetsHash':'test-assets','configuration':{'test':True},'latencyMs':10+10*n,'latencyPhase':'cold' if n==0 else 'warm','peakMemoryBytes':12345,'fields':{f:{'candidate':'CANONICAL','reviewState':'recognized','originalConfidence':89.6,'eligibleForSubmission':False} for f in e.FIELDS}})
        return {'schemaVersion':'SYNTHETIC_LABEL_CORPUS_V1','classification':'SIMULATION_ONLY','datasetVersion':'UNIT_TEST_ONLY','labels':labels,'images':images},predictions

    def test_metrics_failures_state_confusion_confidence_and_latency(self):
        with tempfile.TemporaryDirectory() as tmp:
            m,p=self.fixture(Path(tmp))
            good=e.score(m,p,'validation','UNIT_TEST',Path(tmp))
            self.assertEqual(good['allThreePhotosPerLabel']['MEDIATRIX/printed']['allThreeExact'],1)
            self.assertEqual(good['latencyByPhase']['warm']['p50Ms'],25)
            self.assertIsNone(good['peakMemoryBytes'])
            group=next(x for x in good['conditionFieldMetrics'] if x['bank']=='MEDIATRIX' and x['condition']=='clear' and x['field']=='donationNumber')
            self.assertEqual(group['originalConfidenceMean'],89.6)
            self.assertEqual(group['policyRoundedConfidenceMean'],90)
            self.assertEqual(group['roundedCrosses90'],1)
            p[0]['safeErrorCode']='TEST_FAILURE_WITH_VALUES'
            p.pop(1)
            bad=e.score(m,p,'validation','UNIT_TEST',Path(tmp))
            self.assertEqual(bad['missingPredictions'],1)
            self.assertEqual(bad['perBank']['MEDIATRIX']['completeExact'],1)
            self.assertEqual(bad['allThreePhotosPerLabel']['MEDIATRIX/printed']['allThreeExact'],0)
            matrix=next(x for x in bad['conditionFieldMetrics'] if x['bank']=='MEDIATRIX' and x['condition']=='clear' and x['field']=='donationNumber')['stateConfusion']
            self.assertEqual(matrix['present']['FAILED'],1)
            for state in ('absent','obscured','ambiguous','unreadable'):
                m['images'][2]['fields']['expiresAt']['state']=state
                p[1]['fields']['expiresAt']={'candidate':None,'state':state}
                report=e.score(m,p,'validation','UNIT_TEST',Path(tmp))
                cell=next(x for x in report['conditionFieldMetrics'] if x['bank']=='MEDIATRIX' and x['condition']=='challenging_lighting' and x['field']=='expiresAt')
                self.assertEqual(cell['stateConfusion'][state][state],1)
            p[0]['latencyMs']=float('nan')
            self.assertEqual(e.score(m,p,'validation','UNIT_TEST',Path(tmp))['latencyCoverage'],7)

    def test_empty_percentiles_and_incomplete_conditions(self):
        self.assertEqual(latency_summary([]),{'samples':0,'p50Ms':None,'p95Ms':None})
        self.assertEqual(latency_summary([10,20])['p95Ms'],19.5)
        with tempfile.TemporaryDirectory() as tmp:
            m,p=self.fixture(Path(tmp));m['images']=m['images'][:1];p=p[:1]
            result=e.score(m,p,'validation','UNIT_TEST',Path(tmp))
            self.assertEqual(result['allThreePhotosPerLabel']['MEDIATRIX/printed']['completeConditionSets'],0)

    def test_raw_crop_boundary_and_selection_rejection(self):
        with tempfile.TemporaryDirectory() as tmp:
            base=Path(tmp);m,p=self.fixture(base)
            for row in p:
                row['candidateBoundary']='GROUND_TRUTH_FIELD_CROPS_NOT_END_TO_END_EXTRACTION'
                for field in row['fields'].values():field['candidate']='raw'
            result=e.score(m,p,'validation','UNIT_TEST',base)
            self.assertEqual(result['macroCompleteLabelExact'],1)
            self.assertEqual(result['allThreePhotosPerLabel']['MEDIX/printed']['allThreeExact'],1)
            report=base/'report.json';report.write_text(json.dumps(result))
            run=subprocess.run([sys.executable,str(Path(e.__file__)),'select','--reports',str(report),'--output',str(base/'selection.json')],capture_output=True)
            self.assertNotEqual(run.returncode,0);self.assertFalse((base/'selection.json').exists())
            m['images'][0]['fields']['donationNumber']['rawText']=None
            with self.assertRaisesRegex(ValueError,'rawText'):
                e.score(m,p,'validation','UNIT_TEST',base)

    def test_negative_counts_separate_and_date_precision_not_eligible(self):
        with tempfile.TemporaryDirectory() as tmp:
            base=Path(tmp);m,p=self.fixture(base)
            m['labels'][0]['negativeClass']='conflicting_dates'
            p[0]['fields']['expiresAt']['eligibleForSubmission']=True
            m['images'][3]['fields']['expiresAt']['precision']='DATE'
            p[3]['fields']['expiresAt']['eligibleForSubmission']=True
            result=e.score(m,p,'validation','UNIT_TEST',base)
            self.assertEqual(result['negativeCases']['conflicting_dates']['images'],3)
            self.assertEqual(result['negativeCases']['conflicting_dates']['incorrectEligibleLabels'],1)
            self.assertEqual(result['images'],6)
            self.assertIsNone(result['macroCompleteLabelExact'])
            field=next(x for x in result['metrics'] if x['bank']=='MEDIX' and x['field']=='expiresAt' and x['style']=='printed')
            self.assertEqual(field['incorrectEligible'],1)


if __name__=='__main__':unittest.main()
