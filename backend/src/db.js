import initSqlJs from 'sql.js';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
dotenv.config();

// Pure-WASM SQLite avoids native C++ compilation on Windows (no Visual Studio build tools required).
const require = createRequire(import.meta.url);
const wasmDir = path.dirname(require.resolve('sql.js'));
const SQL = await initSqlJs({ locateFile: (file) => path.join(wasmDir, file) });
const dbFile = process.env.DATABASE_FILE || './data/resource-sharing.db';
const absolute = path.resolve(process.cwd(), dbFile);
fs.mkdirSync(path.dirname(absolute), { recursive: true });
const raw = new SQL.Database(fs.existsSync(absolute) ? new Uint8Array(fs.readFileSync(absolute)) : undefined);
raw.run('PRAGMA foreign_keys = ON');
let transactionDepth = 0;
function persist() {
  if (transactionDepth > 0) return;
  const bytes = raw.export();
  fs.writeFileSync(absolute, Buffer.from(bytes));
}
function normalize(params) { return params.map(v => v === undefined ? null : v); }
function statement(sql) {
  return {
    get(...params) {
      const s = raw.prepare(sql);
      try {
        if (params.length) s.bind(normalize(params));
        return s.step() ? s.getAsObject() : undefined;
      } finally { s.free(); }
    },
    all(...params) {
      const s = raw.prepare(sql); const rows = [];
      try {
        if (params.length) s.bind(normalize(params));
        while (s.step()) rows.push(s.getAsObject());
        return rows;
      } finally { s.free(); }
    },
    run(...params) {
      raw.run(sql, normalize(params));
      const changes = raw.getRowsModified();
      const row = raw.exec('SELECT last_insert_rowid() AS id');
      const lastInsertRowid = row[0]?.values?.[0]?.[0] ?? 0;
      persist();
      return { changes, lastInsertRowid };
    }
  };
}
export const db = {
  prepare: statement,
  exec(sql) { raw.exec(sql); persist(); },
  pragma(value) { try { raw.run(`PRAGMA ${value}`); } catch {} },
  transaction(fn) {
    return (...args) => {
      raw.run('BEGIN TRANSACTION'); transactionDepth++;
      try {
        const result = fn(...args);
        raw.run('COMMIT'); transactionDepth--;
        persist();
        return result;
      } catch (error) {
        try { raw.run('ROLLBACK'); } catch {}
        transactionDepth = Math.max(0, transactionDepth - 1);
        throw error;
      }
    };
  }
};

db.exec(`
CREATE TABLE IF NOT EXISTS users (
 id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE,
 password_hash TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('student','provider','admin')),
 institution TEXT DEFAULT '', location TEXT DEFAULT '', verified INTEGER DEFAULT 0, created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS resources (
 id INTEGER PRIMARY KEY AUTOINCREMENT, owner_id INTEGER NOT NULL REFERENCES users(id), name TEXT NOT NULL,
 category TEXT NOT NULL, description TEXT NOT NULL, location TEXT NOT NULL, image TEXT DEFAULT '',
 hourly_rate REAL DEFAULT 0, deposit REAL DEFAULT 0, requirements TEXT DEFAULT '', safety_rules TEXT DEFAULT '',
 supervision INTEGER DEFAULT 0, status TEXT DEFAULT 'available', available_days TEXT DEFAULT 'Mon,Tue,Wed,Thu,Fri',
 max_hours INTEGER DEFAULT 4, created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS bookings (
 id INTEGER PRIMARY KEY AUTOINCREMENT, resource_id INTEGER NOT NULL REFERENCES resources(id), student_id INTEGER NOT NULL REFERENCES users(id),
 purpose TEXT NOT NULL, start_at TEXT NOT NULL, end_at TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending',
 eligibility_json TEXT DEFAULT '{}', analysis_json TEXT DEFAULT '{}', initial_condition TEXT DEFAULT '', final_condition TEXT DEFAULT '',
 initial_condition_photo TEXT DEFAULT '', final_condition_photo TEXT DEFAULT '', handover_token TEXT DEFAULT '',
 checked_in_at TEXT, returned_at TEXT, waitlist_position INTEGER, created_at TEXT DEFAULT CURRENT_TIMESTAMP, updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS incidents (
 id INTEGER PRIMARY KEY AUTOINCREMENT, booking_id INTEGER NOT NULL REFERENCES bookings(id), reporter_id INTEGER NOT NULL REFERENCES users(id),
 type TEXT NOT NULL, description TEXT NOT NULL, status TEXT DEFAULT 'open', ai_summary TEXT DEFAULT '', evidence_photo TEXT DEFAULT '', evidence_note TEXT DEFAULT '', created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS audit_logs (
 id INTEGER PRIMARY KEY AUTOINCREMENT, actor_id INTEGER REFERENCES users(id), action TEXT NOT NULL,
 entity_type TEXT NOT NULL, entity_id INTEGER, details TEXT DEFAULT '{}', created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS notifications (
 id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id), title TEXT NOT NULL,
 message TEXT NOT NULL, read INTEGER DEFAULT 0, created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS appeals (
 id INTEGER PRIMARY KEY AUTOINCREMENT, booking_id INTEGER NOT NULL REFERENCES bookings(id), student_id INTEGER NOT NULL REFERENCES users(id),
 reason TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','under_review','upheld','denied','closed')),
 reviewer_id INTEGER REFERENCES users(id), reviewer_note TEXT DEFAULT '', created_at TEXT DEFAULT CURRENT_TIMESTAMP, reviewed_at TEXT
);
CREATE TABLE IF NOT EXISTS qualifications (
 id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id), title TEXT NOT NULL, issuer TEXT DEFAULT '', credential_id TEXT DEFAULT '', file_name TEXT NOT NULL, file_data TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','verified','rejected')), reviewer_id INTEGER REFERENCES users(id), reviewer_note TEXT DEFAULT '', created_at TEXT DEFAULT CURRENT_TIMESTAMP, reviewed_at TEXT
);
`);
// Backward-compatible migration for Damage Evidence Assistant attachments and notes.
const incidentColumns = db.prepare('PRAGMA table_info(incidents)').all().map(c => c.name);
if (!incidentColumns.includes('evidence_photo')) db.exec("ALTER TABLE incidents ADD COLUMN evidence_photo TEXT DEFAULT ''");
if (!incidentColumns.includes('evidence_note')) db.exec("ALTER TABLE incidents ADD COLUMN evidence_note TEXT DEFAULT ''");

// Backward-compatible migrations for handover evidence and QR references.
const bookingColumns = db.prepare('PRAGMA table_info(bookings)').all().map(c => c.name);
if (!bookingColumns.includes('initial_condition_photo')) db.exec("ALTER TABLE bookings ADD COLUMN initial_condition_photo TEXT DEFAULT ''");
if (!bookingColumns.includes('final_condition_photo')) db.exec("ALTER TABLE bookings ADD COLUMN final_condition_photo TEXT DEFAULT ''");
if (!bookingColumns.includes('handover_token')) db.exec("ALTER TABLE bookings ADD COLUMN handover_token TEXT DEFAULT ''");
// Give older bookings stable handover references without changing their booking status.
for (const b of db.prepare("SELECT id FROM bookings WHERE handover_token IS NULL OR handover_token=''").all()) {
  db.prepare('UPDATE bookings SET handover_token=? WHERE id=?').run(`SS-${b.id}-${Math.random().toString(36).slice(2,10).toUpperCase()}`, b.id);
}
// Backward-compatible migration for databases created before location-based discovery.
const userColumns = db.prepare('PRAGMA table_info(users)').all().map(c => c.name);
if (!userColumns.includes('location')) db.exec("ALTER TABLE users ADD COLUMN location TEXT DEFAULT ''");
// Demo accounts are intentionally placed in one demo city so the locality filter can be demonstrated.
db.prepare("UPDATE users SET location='Bengaluru, Karnataka' WHERE email IN ('student@demo.com','provider@demo.com') AND (location IS NULL OR location='')").run();

function ensureSeed() {
 const count = db.prepare('SELECT COUNT(*) n FROM users').get().n;
 if (count) return;
 const insertUser = db.prepare('INSERT INTO users(name,email,password_hash,role,institution,location,verified) VALUES(?,?,?,?,?,?,?)');
 const hash = bcrypt.hashSync('Demo123!', 10);
 const student = insertUser.run('Aarav Student','student@demo.com',hash,'student','Bangalore Institute of Technology','Bengaluru, Karnataka',1).lastInsertRowid;
 const provider = insertUser.run('Priya Provider','provider@demo.com',hash,'provider','Innovation Lab','Bengaluru, Karnataka',1).lastInsertRowid;
 insertUser.run('Admin User','admin@demo.com',hash,'admin','Platform Administration','Bengaluru, Karnataka',1);
 const add = db.prepare(`INSERT INTO resources(owner_id,name,category,description,location,image,hourly_rate,deposit,requirements,safety_rules,supervision,status,available_days,max_hours) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
 const items = [
  [provider,'Creality 3D Printer','Fabrication','Reliable FDM 3D printer for prototypes, enclosures, and student engineering projects.','Innovation Lab · Block B','',40,500,'Verified 3D-printing safety training','Keep the enclosure closed; do not leave a print unattended.',1,'available','Mon,Tue,Wed,Thu,Fri,Sat',3],
  [provider,'Electronics Testing Bench','Electronics','Oscilloscope, multimeter, bench power supply, and soldering station.','Electronics Lab · Room 204','',25,250,'Basic electronics lab induction','Wear eye protection when soldering; switch off power after use.',1,'available','Mon,Tue,Wed,Thu,Fri',2],
  [provider,'Mirrorless Camera Kit','Media','Camera body, standard lens, tripod, and two batteries for media projects.','Media Centre · Desk 3','',60,1000,'Valid student ID and handling agreement','Keep equipment dry; return all accessories together.',0,'available','Mon,Tue,Wed,Thu,Fri,Sat',5],
  [provider,'Project Collaboration Room','Meeting Space','Small meeting room with display, whiteboard, and seating for six.','Innovation Hub · Floor 1','',0,0,'Institutional email verification','Leave the room clean and erase the whiteboard.',0,'available','Mon,Tue,Wed,Thu,Fri',3],
  [provider,'Digital Oscilloscope','Testing Equipment','Two-channel digital oscilloscope for circuits and signal analysis.','Electrical Lab · Room 118','',20,300,'Verified electronics lab induction','Use approved probes and remain within rated voltage.',1,'available','Mon,Tue,Wed,Thu,Fri',2]
 ];
 const tx = db.transaction(() => items.forEach(x => add.run(...x)));
 tx();
 const addAudit = db.prepare('INSERT INTO audit_logs(actor_id,action,entity_type,entity_id,details) VALUES(?,?,?,?,?)');
 addAudit.run(provider,'SEED_RESOURCES','system',null,JSON.stringify({count:items.length}));
}
ensureSeed();
export function audit(actorId, action, entityType, entityId, details = {}) {
 db.prepare('INSERT INTO audit_logs(actor_id,action,entity_type,entity_id,details) VALUES(?,?,?,?,?)').run(actorId || null, action, entityType, entityId ?? null, JSON.stringify(details));
}
export function notify(userId, title, message) {
 if (userId) db.prepare('INSERT INTO notifications(user_id,title,message) VALUES(?,?,?)').run(userId,title,message);
}
export function parseJson(value, fallback = {}) { try { return JSON.parse(value || ''); } catch { return fallback; } }
