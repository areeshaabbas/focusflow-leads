
const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');

const db = new DatabaseSync(path.join(__dirname, 'leads.sqlite'));

db.exec(`
  CREATE TABLE IF NOT EXISTS leads (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    createdAt TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'New'
      CHECK(status IN ('New', 'Contacted', 'Qualified', 'Closed')),
    notes TEXT NOT NULL DEFAULT ''
  )
`);

function getLeads() {
  const query = db.prepare(
    'SELECT * FROM leads ORDER BY createdAt DESC, rowid DESC'
  );

  return query.all();
}

function getLead(id) {
  return db.prepare('SELECT * FROM leads WHERE id = ?').get(id);
}

function insertLead(lead) {
  const query = db.prepare(`
    INSERT INTO leads (id, name, email, createdAt)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(id) DO NOTHING
  `);

  const result = query.run(
    lead.id,
    lead.name,
    lead.email,
    lead.createdAt || new Date().toISOString()
  );

  return Number(result.changes) === 1;
}

function updateLead(id, status, notes) {
  const query = db.prepare(
    'UPDATE leads SET status = ?, notes = ? WHERE id = ?'
  );

  query.run(status, notes, id);

  return getLead(id);
}

module.exports = {
  getLeads,
  getLead,
  insertLead,
  updateLead
};
