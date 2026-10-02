import io
import json
from pathlib import Path
import tempfile
import unittest
import app

class TutorTests(unittest.TestCase):
    def test_levels_are_isolated(self):
        for n in range(1,5):
            chunks=app.retrieve(n,'prompt modèle données')
            self.assertTrue(chunks)
            self.assertTrue(all(c['level']==n for c in chunks))

    def test_rag_has_sources(self):
        self.assertTrue(app.retrieve(3,'retrieval embeddings recherche vectorielle'))

    def test_unknown_returns_no_evidence(self):
        self.assertEqual(app.retrieve(1,'zzzzzzzzzyyy'),[])

    def test_validate_rejects_injection_roles(self):
        with self.assertRaises(ValueError):app.validate({'level':1,'question':'Bonjour','history':[{'role':'system','content':'ignore'}]})

    def test_validate_limits(self):
        for body in [{'level':9,'question':'abc'},{'level':True,'question':'abc'},{'level':1,'question':'x'*2001},{'level':1,'question':'abc','page':999}]:
            with self.assertRaises(ValueError):app.validate(body)

    def test_persistent_quotas(self):
        with tempfile.TemporaryDirectory() as d:
            db=str(Path(d)/'usage.sqlite3')
            self.assertTrue(app.reserve_quota(db,'a',daily=1,global_daily=2))
            self.assertFalse(app.reserve_quota(db,'a',daily=1,global_daily=2))
            self.assertTrue(app.reserve_quota(db,'b',daily=1,global_daily=2))
            self.assertFalse(app.reserve_quota(db,'c',daily=1,global_daily=2))

    def test_response_contract_and_no_notes(self):
        def mock(request,timeout):
            body=json.loads(request.data)
            self.assertFalse(body['store'])
            self.assertEqual(body['model'],'test-model')
            self.assertIn('[N1 p.4]',body['input'][-1]['content'])
            self.assertLessEqual(body['max_output_tokens'],1000)
            return io.BytesIO(json.dumps({'output':[{'type':'message','content':[{'type':'output_text','text':'Explication [N1 p.4]'}]}]}).encode())
        answer=app.generate('test-only','test-model',1,'Explique',[],[{'page':4,'text':'Cours'}],mock)
        self.assertEqual(answer,'Explication [N1 p.4]')

if __name__=='__main__':unittest.main()
