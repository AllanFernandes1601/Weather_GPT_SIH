import 'dotenv/config';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const checks = [];

function add(name, ok, detail) {
  checks.push({ name, ok, detail });
}

const geminiKey = process.env.GEMINI_API_KEY || '';
add(
  'Gemini API key',
  Boolean(geminiKey) && !/YOUR_|MY_|placeholder/i.test(geminiKey),
  geminiKey ? 'configured without displaying the value' : 'missing'
);
add('Gemini model', Boolean(process.env.GEMINI_MODEL || 'gemini-3.6-flash'), process.env.GEMINI_MODEL || 'gemini-3.6-flash');

const database = path.resolve(root, process.env.WEATHERGPT_RAG_DB || 'rag/data/weathergpt.sqlite');
add('RAG database', existsSync(database), database);

const ragPython = process.env.RAG_PYTHON_BIN || 'python3';
if (existsSync(database)) {
  const integrity = spawnSync(
    ragPython,
    ['-c', 'import sqlite3,sys; c=sqlite3.connect(sys.argv[1]); print(c.execute("PRAGMA integrity_check").fetchone()[0]); print(c.execute("SELECT COUNT(*) FROM dataset_manifest").fetchone()[0])', database],
    { encoding: 'utf8' }
  );
  const lines = integrity.stdout.trim().split(/\r?\n/);
  add('Database integrity', integrity.status === 0 && lines[0] === 'ok', lines[0] || integrity.stderr.trim());
  add('Dataset manifest', Number(lines[1]) === 8, `${lines[1] || 0} of 8 datasets`);
}

const mlPython = path.resolve(root, process.env.ML_PYTHON_BIN || '.venv/bin/python');
add('ML Python environment', existsSync(mlPython), mlPython);
if (existsSync(mlPython)) {
  const imports = spawnSync(mlPython, ['-c', 'import numpy,pandas,sklearn,xgboost,joblib'], { encoding: 'utf8' });
  add('ML dependencies', imports.status === 0, imports.status === 0 ? 'available' : imports.stderr.trim().split('\n').at(-1));
}
add('Rain model', existsSync(path.join(root, 'ml/models/rain_model.pkl')), 'ml/models/rain_model.pkl');
add('Production build', existsSync(path.join(root, 'dist/server.cjs')), 'dist/server.cjs');

const failed = checks.filter(check => !check.ok);
console.log(JSON.stringify({ ready: failed.length === 0, checks }, null, 2));
if (failed.length) process.exit(1);
