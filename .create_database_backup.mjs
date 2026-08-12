import { createConnection } from 'mysql2/promise';
import { createHash } from 'node:crypto';
import { mkdir, writeFile, cp } from 'node:fs/promises';
import path from 'node:path';

const backupTimestamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupDir = `/home/ubuntu/OMS營運資料備份_${backupTimestamp}`;
const csvDir = path.join(backupDir, 'csv');
const jsonDir = path.join(backupDir, 'json');

function csvCell(value) {
  if (value === null || value === undefined) return '';
  const text = value instanceof Date ? value.toISOString() : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

function sha256(content) {
  return createHash('sha256').update(content).digest('hex');
}

await mkdir(csvDir, { recursive: true });
await mkdir(jsonDir, { recursive: true });

const connection = await createConnection(process.env.DATABASE_URL);
const [tables] = await connection.query('SHOW TABLES');
const tableKey = Object.keys(tables[0] ?? {})[0];
const excludedTables = new Set(['__drizzle_migrations']);
const manifestTables = [];

for (const tableRow of tables) {
  const tableName = tableRow[tableKey];
  if (excludedTables.has(tableName)) continue;

  const [columns] = await connection.query(`SHOW COLUMNS FROM \`${tableName}\``);
  const columnNames = columns.map((column) => column.Field);
  const [records] = await connection.query(`SELECT * FROM \`${tableName}\``);

  const csvContent = [
    columnNames.map(csvCell).join(','),
    ...records.map((record) => columnNames.map((column) => csvCell(record[column])).join(',')),
  ].join('\n') + '\n';
  const jsonContent = JSON.stringify(records, null, 2) + '\n';

  const csvFile = `${tableName}.csv`;
  const jsonFile = `${tableName}.json`;
  await writeFile(path.join(csvDir, csvFile), csvContent, 'utf8');
  await writeFile(path.join(jsonDir, jsonFile), jsonContent, 'utf8');

  manifestTables.push({
    table: tableName,
    rows: records.length,
    csvFile: `csv/${csvFile}`,
    csvSha256: sha256(csvContent),
    jsonFile: `json/${jsonFile}`,
    jsonSha256: sha256(jsonContent),
  });
}

await connection.end();

await cp('/home/ubuntu/order_management_system/drizzle/schema.ts', path.join(backupDir, 'schema.ts'));

const manifest = {
  backupName: 'Order Management System 營運資料備份',
  createdAtUtc: new Date().toISOString(),
  source: 'order_management_system production database',
  recordCount: manifestTables.reduce((sum, item) => sum + item.rows, 0),
  notes: [
    '每個資料表同時提供 CSV（可用 Excel 開啟）及 JSON（保留資料結構以便技術還原）。',
    'schema.ts 為系統資料庫結構定義；實際還原前請先於測試環境核對欄位與關聯。',
    '備份含客戶聯絡及地址等個人資料，請勿公開分享、提交至公開 GitHub，或存放於未受保護裝置。',
    '此備份只涵蓋資料庫資料，不包含 S3 上傳的 PDF、收據圖片及其他附件。',
  ],
  tables: manifestTables,
};

const manifestContent = JSON.stringify(manifest, null, 2) + '\n';
await writeFile(path.join(backupDir, 'manifest.json'), manifestContent, 'utf8');

const readme = `# 訂單管理系統營運資料備份\n\n**建立時間（UTC）：** ${manifest.createdAtUtc}\n\n本備份包含 ${manifestTables.length} 個資料表、合共 ${manifest.recordCount.toLocaleString()} 筆紀錄。\n\n| 內容 | 用途 |\n|---|---|\n| \`csv/\` | CSV 格式，可使用 Excel 開啟作檢視與篩選。|\n| \`json/\` | JSON 格式，適合日後由技術人員匯入／還原。|\n| \`schema.ts\` | 資料庫資料表及欄位結構定義。|\n| \`manifest.json\` | 檔案清單、筆數及 SHA-256 完整性校驗值。|\n\n## 保密提示\n\n此檔案含訂單、顧客聯絡資料及送貨地址。請僅存放於受保護位置，避免上載至公開 GitHub、公共雲端連結或未加密裝置。\n\n## 附件範圍\n\n本備份不包括儲存在 S3 的收據圖片、採購單 PDF、發票／收據 PDF 等檔案附件；它們由系統檔案儲存服務另行管理。\n`;
await writeFile(path.join(backupDir, 'README.md'), readme, 'utf8');

console.log(JSON.stringify({ backupDir, manifest }, null, 2));
