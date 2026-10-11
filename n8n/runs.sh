#!/bin/sh
# n8n/runs.sh <workflow-name-fragment> [n]  -> last run of that workflow, node by node (debug helper)
cd "$(dirname "$0")/.."
K=$(cat ../../Credentials/n8n/api-key.txt)
ID=$(python -c "import json;d=json.load(open('n8n/workflow-ids.json'));print([v for k,v in d.items() if '$1'.lower() in k.lower()][0])")
E=$(curl -s -H "X-N8N-API-KEY: $K" "localhost:5678/api/v1/executions?workflowId=$ID&limit=${2:-1}" | python -c "import json,sys;print(' '.join(e['id']+':'+e['status'] for e in json.load(sys.stdin)['data']))")
echo "runs: $E"
for x in $E; do
curl -s -H "X-N8N-API-KEY: $K" "localhost:5678/api/v1/executions/${x%%:*}?includeData=true" | python -c "
import json,sys
d=json.load(sys.stdin)['data']['resultData']
if d.get('error'): print('WORKFLOW ERROR', str(d['error'].get('message'))[:300])
for k,v in d['runData'].items():
  for r in v:
    o=(r.get('data') or {}).get('main') or [[]]; items=sum(len(b or []) for b in o); first=next((b[0]['json'] for b in o if b), {})
    print(f\"{r.get('executionTime',0):>6}ms {k} [{items}]\", ('ERR '+str(r.get('error',{}).get('message'))[:200]) if r.get('error') else json.dumps(first,default=str,ensure_ascii=False)[:150])
"
done
