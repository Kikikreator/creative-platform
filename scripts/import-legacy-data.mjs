import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "csv-parse/sync";
import { createClient } from "@supabase/supabase-js";
import { syntheticAuthEmail } from "../api/_lib/supabase.js";

/*
 * GARMENT PADANG — LEGACY DATA IMPORTER
 *
 * Default mode: preflight only (no database changes).
 * Apply mode:   node scripts/import-legacy-data.mjs --apply
 *
 * IMPORTANT:
 * - .env must remain local and must never be uploaded to GitHub.
 * - SUPABASE_SERVICE_ROLE_KEY is a secret with elevated database access.
 * - All 14 CSV exports must be present in /exports before applying migration.
 */

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_DIR = path.resolve(SCRIPT_DIR, "..");
const EXPORT_DIR = path.join(PROJECT_DIR, "exports");
const ENV_FILE = path.join(PROJECT_DIR, ".env");
const APPLY_CHANGES = process.argv.includes("--apply");

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;

  const content = fs.readFileSync(filePath, "utf8");
  for (const originalLine of content.split(/\r?\n/)) {
    const line = originalLine.trim();
    if (!line || line.startsWith("#")) continue;

    const match = line.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue;

    const key = match[1];
    let value = match[2].trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    } else {
      value = value.replace(/\s+#.*$/, "").trim();
    }

    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

loadEnvFile(ENV_FILE);

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

let supabase = null;

function createSupabaseClient() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      "Konfigurasi belum lengkap. Isi SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY pada file .env."
    );
  }

  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}

const REQUIRED_EXPORTS = [
  "Users.csv",
  "Clients.csv",
  "Resellers.csv",
  "Settings.csv",
  "Orders.csv",
  "Absensi.csv",
  "Kasbon.csv",
  "Gaji.csv",
  "HPP.csv",
  "BiayaOperasional.csv",
  "KategoriBiaya.csv",
  "InvestorData.csv",
  "MASTER_TUKANG.csv",
  "INVESTOR_PROJECT.csv"
];

const norm = (value) => String(value ?? "").trim().toLowerCase();

function valueOf(row, key) {
  const value = row?.[key];
  return value === undefined || value === null ? "" : String(value).trim();
}

function rawValueOf(row, key) {
  const value = row?.[key];
  return value === undefined || value === null ? "" : String(value);
}

function isBlankRow(row) {
  return Object.values(row || {}).every((value) => String(value ?? "").trim() === "");
}

function readCsv(filename, requiredHeaderGroups = []) {
  const filePath = path.join(EXPORT_DIR, filename);

  if (!fs.existsSync(filePath)) {
    throw new Error(
      `File ${filename} tidak ditemukan di folder exports. Migrasi dihentikan agar data tidak terlewat.`
    );
  }

  const csvText = fs.readFileSync(filePath, "utf8");

  if (!csvText.trim()) {
    throw new Error(`File ${filename} kosong. Pastikan file CSV hasil ekspor benar.`);
  }

  const headerRows = parse(csvText, {
    bom: true,
    to_line: 1,
    skip_empty_lines: true,
    relax_quotes: true
  });

  const headers = (headerRows[0] || []).map((header) => String(header).trim());

  if (!headers.length) {
    throw new Error(`Header kolom pada ${filename} tidak dapat dibaca.`);
  }

  const duplicateHeaders = headers.filter(
    (header, index) => headers.indexOf(header) !== index
  );

  if (duplicateHeaders.length) {
    throw new Error(
      `Ada nama kolom duplikat pada ${filename}: ${[...new Set(duplicateHeaders)].join(", ")}`
    );
  }

  for (const alternatives of requiredHeaderGroups) {
    const found = alternatives.some((header) => headers.includes(header));

    if (!found) {
      throw new Error(
        `Kolom wajib pada ${filename} tidak ditemukan. Salah satu kolom berikut harus ada: ${alternatives.join(" / ")}. Kolom yang terbaca: ${headers.join(", ")}`
      );
    }
  }

  const rows = parse(csvText, {
    columns: (columns) => columns.map((column) => String(column).trim()),
    skip_empty_lines: true,
    bom: true,
    relax_quotes: true
  });

  return rows.filter((row) => !isBlankRow(row));
}

function requiredId(row, key, filename, rowIndex) {
  const id = valueOf(row, key);

  if (!id) {
    throw new Error(
      `${filename}, baris data ${rowIndex + 1}: kolom ${key} kosong. Baris ini tidak akan dilewati diam-diam.`
    );
  }

  return id;
}

function assertUnique(values, label) {
  const seen = new Set();

  for (const value of values) {
    const key = norm(value);
    if (!key) continue;

    if (seen.has(key)) {
      throw new Error(`${label} duplikat ditemukan: ${value}`);
    }

    seen.add(key);
  }
}

function assertUniqueIds(rows, tableName) {
  assertUnique(
    rows.map((row) => row.id),
    `ID pada data ${tableName}`
  );
}

function numberValue(value, context = "angka") {
  if (value === null || value === undefined || String(value).trim() === "") {
    return 0;
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new Error(`Nilai ${context} bukan angka yang valid.`);
    }
    return value;
  }

  let text = String(value).trim().replace(/[^\d,.-]/g, "");

  if (!text || text === "-" || text === "," || text === ".") {
    return 0;
  }

  if (text.includes(",") && text.includes(".")) {
    if (text.lastIndexOf(",") > text.lastIndexOf(".")) {
      text = text.replace(/\./g, "").replace(",", ".");
    } else {
      text = text.replace(/,/g, "");
    }
  } else if (text.includes(",")) {
    text = text.replace(",", ".");
  } else if (/^-?\d{1,3}(\.\d{3})+$/.test(text)) {
    text = text.replace(/\./g, "");
  }

  const number = Number(text);

  if (!Number.isFinite(number)) {
    throw new Error(`Nilai ${context} tidak dapat dibaca sebagai angka: ${value}`);
  }

  return number;
}

function dateValue(value, context = "tanggal") {
  if (!value || String(value).trim() === "-") return null;

  const text = String(value).trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return text;
  }

  const dmy = text.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);

  if (dmy) {
    const day = Number(dmy[1]);
    const month = Number(dmy[2]);
    const year = Number(dmy[3]);

    const date = new Date(Date.UTC(year, month - 1, day));

    if (
      date.getUTCFullYear() === year &&
      date.getUTCMonth() === month - 1 &&
      date.getUTCDate() === day
    ) {
      return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }

    throw new Error(`Tanggal ${context} tidak valid: ${text}`);
  }

  const dmyText = text.match(/^(\d{1,2})[- ]([A-Za-z]{3})[- ](\d{4})$/);

  if (dmyText) {
    const months = {
      jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
      jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12
    };

    const month = months[dmyText[2].toLowerCase()];

    if (month) {
      const day = Number(dmyText[1]);
      const year = Number(dmyText[3]);
      const date = new Date(Date.UTC(year, month - 1, day));

      if (
        date.getUTCFullYear() === year &&
        date.getUTCMonth() === month - 1 &&
        date.getUTCDate() === day
      ) {
        return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      }
    }
  }

  const parsed = new Date(text);

  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }

  throw new Error(`Tanggal ${context} tidak dapat dibaca dari CSV: ${text}`);
}

function jsonValue(raw, fallback = [], context = "JSON") {
  if (raw === null || raw === undefined || String(raw).trim() === "") {
    return fallback;
  }

  try {
    return JSON.parse(String(raw));
  } catch (error) {
    throw new Error(`${context} tidak berisi JSON yang valid: ${error.message}`);
  }
}

function mapRowsWithId(rows, filename, idColumn, mapper) {
  const mapped = rows.map((row, index) => {
    const id = requiredId(row, idColumn, filename, index);
    return mapper(row, index, id);
  });

  return mapped;
}

async function upsertRows(table, rows, onConflict = "id") {
  if (!rows.length) {
    console.log(`[OK] ${table}: 0 baris data.`);
    return;
  }

  assertUniqueIds(rows, table);

  for (let index = 0; index < rows.length; index += 500) {
    const batch = rows.slice(index, index + 500);
    const { error } = await supabase
      .from(table)
      .upsert(batch, { onConflict });

    if (error) {
      throw new Error(`Gagal mengimpor ${table}: ${error.message}`);
    }
  }

  console.log(`[OK] ${table}: ${rows.length} baris berhasil di-upsert.`);
}

function prepareAllData() {
  console.log("\nMemeriksa 14 file CSV...");
  console.log(`Folder sumber: ${EXPORT_DIR}\n`);

  const users = readCsv("Users.csv", [
    ["ID_User"],
    ["Username"],
    ["Password"]
  ]);

  const clientsRaw = readCsv("Clients.csv", [["ID_Klien"]]);
  const resellersRaw = readCsv("Resellers.csv", [["ID_Reseller"]]);
  const settingsRaw = readCsv("Settings.csv", [["Key"]]);
  const ordersRaw = readCsv("Orders.csv", [["ID_Order"]]);
  const attendanceRaw = readCsv("Absensi.csv", [["ID_Absen"]]);
  const kasbonRaw = readCsv("Kasbon.csv", [["ID_Kasbon"]]);
  const payrollRaw = readCsv("Gaji.csv", [["ID_Gaji"]]);
  const hppRaw = readCsv("HPP.csv", [["ID_HPP"]]);
  const expensesRaw = readCsv("BiayaOperasional.csv", [["ID_Biaya"]]);
  const categoriesRaw = readCsv("KategoriBiaya.csv", [["ID_Kategori"]]);
  const investorDataRaw = readCsv("InvestorData.csv", [["PayloadJson"]]);
  const masterTukangRaw = readCsv("MASTER_TUKANG.csv", [
    ["Nama Tukang", "Nama_Tukang", "Nama"]
  ]);
  const investorProjectsRaw = readCsv("INVESTOR_PROJECT.csv", [
    ["Nama Investor", "Tanggal Setor"]
  ]);

  if (!users.length) {
    throw new Error("Users.csv tidak memiliki akun. Migrasi akun dihentikan.");
  }

  const seenUsernames = new Set();
  const seenLegacyUserIds = new Set();

  const preparedUsers = users.map((row, index) => {
    const id = requiredId(row, "ID_User", "Users.csv", index);
    const username = valueOf(row, "Username");
    const password = rawValueOf(row, "Password").trim();

    if (!username) {
      throw new Error(`Users.csv, baris data ${index + 1}: Username kosong.`);
    }

    if (!password) {
      throw new Error(`Users.csv, baris data ${index + 1}: Password kosong untuk akun ${id}.`);
    }

    const normalizedUsername = norm(username);
    const normalizedId = norm(id);

    if (seenUsernames.has(normalizedUsername)) {
      throw new Error(`Username duplikat di Users.csv: ${username}`);
    }

    if (seenLegacyUserIds.has(normalizedId)) {
      throw new Error(`ID_User duplikat di Users.csv: ${id}`);
    }

    seenUsernames.add(normalizedUsername);
    seenLegacyUserIds.add(normalizedId);

    return {
      legacy_row_order: index + 1,
      legacy_user_id: id,
      username,
      username_normalized: normalizedUsername,
      auth_email: syntheticAuthEmail(id),
      password,
      role: valueOf(row, "Role") || "Karyawan",
      full_name: valueOf(row, "Nama_Lengkap") || username,
      position: valueOf(row, "Jabatan") || "-"
    };
  });

  const clients = mapRowsWithId(clientsRaw, "Clients.csv", "ID_Klien", (row, index, id) => ({
    legacy_row_order: index + 1,
    id,
    name: valueOf(row, "Nama_Klien"),
    institution: valueOf(row, "Asal_Instansi"),
    whatsapp: valueOf(row, "No_WA")
  }));

  const resellers = mapRowsWithId(resellersRaw, "Resellers.csv", "ID_Reseller", (row, index, id) => ({
    legacy_row_order: index + 1,
    id,
    name: valueOf(row, "Nama_Reseller"),
    institution: valueOf(row, "Asal_Instansi"),
    whatsapp: valueOf(row, "No_WA")
  }));

  const settings = settingsRaw.map((row, index) => ({
    id: `S-${index + 1}`,
    key: valueOf(row, "Key"),
    value: valueOf(row, "Value"),
    wage_price: valueOf(row, "Harga_Upah")
      ? numberValue(row["Harga_Upah"], `Settings.csv baris ${index + 1}, Harga_Upah`)
      : null,
    order_index: index + 1
  }));

  const orders = mapRowsWithId(ordersRaw, "Orders.csv", "ID_Order", (row, index, id) => ({
    legacy_row_order: index + 1,
    id,
    order_date: dateValue(valueOf(row, "Tanggal_Masuk"), `Orders.csv baris ${index + 1}`),
    client_id: valueOf(row, "ID_Klien") || null,
    reseller_id: valueOf(row, "ID_Reseller") || null,
    title: valueOf(row, "Judul_Order"),
    items: jsonValue(valueOf(row, "Item_Pakaian_JSON"), [], `Orders.csv baris ${index + 1}, Item_Pakaian_JSON`),
    items_json_raw: valueOf(row, "Item_Pakaian_JSON"),
    total_pcs: numberValue(row["Jumlah_Pcs_Total"], `Orders.csv baris ${index + 1}, Jumlah_Pcs_Total`),
    description: valueOf(row, "Keterangan"),
    deadline: dateValue(valueOf(row, "Deadline"), `Orders.csv baris ${index + 1}, Deadline`),
    status: valueOf(row, "Status_Order"),
    total_price: numberValue(row["Total_Harga"], `Orders.csv baris ${index + 1}, Total_Harga`),
    dp: numberValue(row["DP"], `Orders.csv baris ${index + 1}, DP`),
    remaining_bill: numberValue(row["Sisa_Tagihan"], `Orders.csv baris ${index + 1}, Sisa_Tagihan`),
    fee_per_piece: numberValue(row["Fee_Per_Pcs"], `Orders.csv baris ${index + 1}, Fee_Per_Pcs`)
  }));

  const attendance = mapRowsWithId(attendanceRaw, "Absensi.csv", "ID_Absen", (row, index, id) => {
    const date = dateValue(valueOf(row, "Tanggal"), `Absensi.csv baris ${index + 1}, Tanggal`);
    if (!date) {
      throw new Error(`Absensi.csv baris ${index + 1}: Tanggal wajib diisi.`);
    }

    return {
      legacy_row_order: index + 1,
      id,
      date,
      username: valueOf(row, "Username"),
      employee_name: valueOf(row, "Nama_Karyawan"),
      status: valueOf(row, "Status"),
      time_in: valueOf(row, "Jam_Masuk") || "-",
      time_out: valueOf(row, "Jam_Pulang") || "-",
      late_minutes: numberValue(row["Menit_Terlambat"], `Absensi.csv baris ${index + 1}, Menit_Terlambat`),
      overtime_status: valueOf(row, "Status_Lembur"),
      location_in: valueOf(row, "Lokasi_Masuk"),
      location_out: valueOf(row, "Lokasi_Pulang"),
      note: valueOf(row, "Catatan")
    };
  });

  const kasbon = mapRowsWithId(kasbonRaw, "Kasbon.csv", "ID_Kasbon", (row, index, id) => ({
    legacy_row_order: index + 1,
    id,
    date: dateValue(valueOf(row, "Tanggal"), `Kasbon.csv baris ${index + 1}, Tanggal`),
    employee_name: valueOf(row, "Nama_Tukang"),
    work_items: jsonValue(valueOf(row, "Pekerjaan_JSON"), [], `Kasbon.csv baris ${index + 1}, Pekerjaan_JSON`),
    work_items_json_raw: valueOf(row, "Pekerjaan_JSON"),
    total_wage: numberValue(row["Total_Upah"], `Kasbon.csv baris ${index + 1}, Total_Upah`),
    advance_amount: numberValue(row["Nominal_Kasbon"], `Kasbon.csv baris ${index + 1}, Nominal_Kasbon`),
    remaining_wage: numberValue(row["Sisa_Upah"], `Kasbon.csv baris ${index + 1}, Sisa_Upah`)
  }));

  const payroll = mapRowsWithId(payrollRaw, "Gaji.csv", "ID_Gaji", (row, index, id) => ({
    legacy_row_order: index + 1,
    id,
    date: dateValue(valueOf(row, "Tanggal"), `Gaji.csv baris ${index + 1}, Tanggal`),
    employee_name: valueOf(row, "Nama_Pegawai"),
    position: valueOf(row, "Jabatan"),
    base_salary: numberValue(row["Gaji_Pokok"], `Gaji.csv baris ${index + 1}, Gaji_Pokok`),
    bonus: numberValue(row["Bonus"], `Gaji.csv baris ${index + 1}, Bonus`),
    advance: numberValue(row["Kasbon"], `Gaji.csv baris ${index + 1}, Kasbon`),
    deduction: numberValue(row["Potongan"], `Gaji.csv baris ${index + 1}, Potongan`),
    total_received: numberValue(row["Total_Terima"], `Gaji.csv baris ${index + 1}, Total_Terima`)
  }));

  const hpp = mapRowsWithId(hppRaw, "HPP.csv", "ID_HPP", (row, index, id) => ({
    legacy_row_order: index + 1,
    id,
    order_id: valueOf(row, "ID_Order"),
    item_index: numberValue(row["Index_Item"], `HPP.csv baris ${index + 1}, Index_Item`),
    item_name: valueOf(row, "Nama_Item"),
    order_qty: numberValue(row["Qty_Order"], `HPP.csv baris ${index + 1}, Qty_Order`),
    cost_components: jsonValue(valueOf(row, "Komponen_Biaya_JSON"), [], `HPP.csv baris ${index + 1}, Komponen_Biaya_JSON`),
    cost_components_json_raw: valueOf(row, "Komponen_Biaya_JSON"),
    total_hpp: numberValue(row["Total_HPP"], `HPP.csv baris ${index + 1}, Total_HPP`),
    hpp_per_piece: numberValue(row["HPP_Per_Pcs"], `HPP.csv baris ${index + 1}, HPP_Per_Pcs`),
    total_sales: numberValue(row["Total_Penjualan"], `HPP.csv baris ${index + 1}, Total_Penjualan`),
    gross_profit: numberValue(row["Laba_Kotor"], `HPP.csv baris ${index + 1}, Laba_Kotor`),
    margin_percent: numberValue(row["Margin_Persen"], `HPP.csv baris ${index + 1}, Margin_Persen`),
    status: valueOf(row, "Status_HPP"),
    updated_at: valueOf(row, "Updated_At") || null
  }));

  const expenses = mapRowsWithId(
    expensesRaw,
    "BiayaOperasional.csv",
    "ID_Biaya",
    (row, index, id) => ({
      legacy_row_order: index + 1,
      id,
      date: dateValue(valueOf(row, "Tanggal"), `BiayaOperasional.csv baris ${index + 1}, Tanggal`),
      description: valueOf(row, "Keterangan"),
      category: valueOf(row, "Kategori"),
      amount: numberValue(row["Nominal"], `BiayaOperasional.csv baris ${index + 1}, Nominal`),
      note: valueOf(row, "Catatan"),
      created_at: valueOf(row, "Created_At") || null
    })
  );

  const categories = mapRowsWithId(
    categoriesRaw,
    "KategoriBiaya.csv",
    "ID_Kategori",
    (row, index, id) => ({
      legacy_row_order: index + 1,
      id,
      name: valueOf(row, "Nama_Kategori"),
      created_at: valueOf(row, "Created_At") || null
    })
  );

  const investorData = investorDataRaw.map((row, index) => {
    const raw = valueOf(row, "PayloadJson");
    const payload = raw
      ? jsonValue(raw, null, `InvestorData.csv baris ${index + 1}, PayloadJson`)
      : null;

    return {
      id: `INV-${index + 1}`,
      created_at: valueOf(row, "Timestamp") || null,
      legacy_row_order: index + 1,
      payload,
      raw_payload: raw || null
    };
  });

  const masterTukang = masterTukangRaw.map((row, index) => {
    const name =
      valueOf(row, "Nama Tukang") ||
      valueOf(row, "Nama_Tukang") ||
      valueOf(row, "Nama");

    if (!name) {
      throw new Error(`MASTER_TUKANG.csv baris ${index + 1}: nama tukang kosong.`);
    }

    return {
      id: `T-${index + 1}`,
      name,
      order_index: index + 1
    };
  });

  const investorProjects = investorProjectsRaw.map((row, index) => {
    const investorName = valueOf(row, "Nama Investor");
    const investmentDate = dateValue(
      valueOf(row, "Tanggal Setor"),
      `INVESTOR_PROJECT.csv baris ${index + 1}, Tanggal Setor`
    );

    if (!investorName && !investmentDate) {
      throw new Error(
        `INVESTOR_PROJECT.csv baris ${index + 1}: Nama Investor atau Tanggal Setor harus tersedia.`
      );
    }

    return {
      id: `IP-${index + 1}`,
      investment_date: investmentDate,
      return_date: dateValue(
        valueOf(row, "Tanggal Pengembalian"),
        `INVESTOR_PROJECT.csv baris ${index + 1}, Tanggal Pengembalian`
      ),
      investor_name: investorName,
      principal_amount: numberValue(row["Jumlah Modal Disetor"], `INVESTOR_PROJECT.csv baris ${index + 1}, Jumlah Modal Disetor`),
      dividend: numberValue(row["Dividen (10%)"], `INVESTOR_PROJECT.csv baris ${index + 1}, Dividen (10%)`),
      total_return: numberValue(row["Total"], `INVESTOR_PROJECT.csv baris ${index + 1}, Total`),
      order_index: index + 1
    };
  });

  const data = {
    users: preparedUsers,
    clients,
    resellers,
    settings,
    orders,
    attendance,
    kasbon,
    payroll,
    hpp,
    operational_expenses: expenses,
    expense_categories: categories,
    investor_records: investorData,
    master_tukang: masterTukang,
    investor_projects: investorProjects
  };

  assertUniqueIds(clients, "clients");
  assertUniqueIds(resellers, "resellers");
  assertUniqueIds(orders, "orders");
  assertUniqueIds(attendance, "attendance");
  assertUniqueIds(kasbon, "kasbon");
  assertUniqueIds(payroll, "payroll");
  assertUniqueIds(hpp, "hpp");
  assertUniqueIds(expenses, "operational_expenses");
  assertUniqueIds(categories, "expense_categories");

  return data;
}

function printSummary(data) {
  console.log("\n========== RINGKASAN PEMERIKSAAN CSV ==========");

  for (const [name, rows] of Object.entries(data)) {
    console.log(`${name.padEnd(24)} : ${rows.length} baris`);
  }

  console.log("================================================\n");
}

async function importUsers(rows) {
  console.log("\nMemproses akun pengguna melalui Supabase Auth...");

  for (const [index, row] of rows.entries()) {
    const { data: existingProfile, error: lookupError } = await supabase
      .from("profiles")
      .select("id")
      .eq("legacy_user_id", row.legacy_user_id)
      .maybeSingle();

    if (lookupError) {
      throw new Error(`Gagal memeriksa profil ${row.username}: ${lookupError.message}`);
    }

    let authUserId;
    let createdNewAuthUser = false;

    if (existingProfile?.id) {
      authUserId = existingProfile.id;

      const { error } = await supabase.auth.admin.updateUserById(authUserId, {
        email: row.auth_email,
        password: row.password,
        email_confirm: true,
        user_metadata: {
          legacy_user_id: row.legacy_user_id,
          username: row.username
        }
      });

      if (error) {
        throw new Error(`Gagal memperbarui akun ${row.username}: ${error.message}`);
      }
    } else {
      const { data: created, error } = await supabase.auth.admin.createUser({
        email: row.auth_email,
        password: row.password,
        email_confirm: true,
        user_metadata: {
          legacy_user_id: row.legacy_user_id,
          username: row.username
        }
      });

      if (error) {
        throw new Error(`Gagal membuat akun ${row.username}: ${error.message}`);
      }

      authUserId = created.user.id;
      createdNewAuthUser = true;
    }

    const profile = {
      id: authUserId,
      legacy_user_id: row.legacy_user_id,
      username: row.username,
      username_normalized: row.username_normalized,
      role: row.role,
      full_name: row.full_name,
      position: row.position,
      auth_email: row.auth_email,
      is_active: true,
      legacy_row_order: row.legacy_row_order
    };

    const { error: profileError } = await supabase
      .from("profiles")
      .upsert(profile, { onConflict: "id" });

    if (profileError) {
      if (createdNewAuthUser) {
        await supabase.auth.admin.deleteUser(authUserId);
      }

      throw new Error(
        `Gagal menyimpan profil ${row.username}: ${profileError.message}`
      );
    }

    console.log(`[OK] Akun ${index + 1}/${rows.length}: ${row.username}`);
  }

  console.log(`[OK] ${rows.length} akun diproses. Password tidak disimpan ke tabel profiles.`);
}

async function applyMigration(data) {
  supabase = createSupabaseClient();

  console.log("\nMODE APPLY AKTIF — data akan dikirim ke Supabase.");
  console.log("Pastikan project Supabase dan backup CSV sudah benar.\n");

  await importUsers(data.users);

  await upsertRows("clients", data.clients);
  await upsertRows("resellers", data.resellers);
  await upsertRows("settings", data.settings);
  await upsertRows("orders", data.orders);
  await upsertRows("attendance", data.attendance);
  await upsertRows("kasbon", data.kasbon);
  await upsertRows("payroll", data.payroll);
  await upsertRows("hpp", data.hpp);
  await upsertRows("operational_expenses", data.operational_expenses);
  await upsertRows("expense_categories", data.expense_categories);
  await upsertRows("investor_records", data.investor_records);
  await upsertRows("master_tukang", data.master_tukang);
  await upsertRows("investor_projects", data.investor_projects);

  console.log("\nMigrasi selesai.");
  console.log("Bandingkan jumlah baris dan total nominal dengan Google Sheets.");
  console.log("CSV sumber tetap berada di folder exports lokal.");
}

async function main() {
  console.log("==============================================");
  console.log(" GARMENT PADANG — PEMERIKSAAN MIGRASI DATA");
  console.log("==============================================");

  const data = prepareAllData();
  printSummary(data);

  if (!APPLY_CHANGES) {
    console.log("PREFLIGHT BERHASIL: semua file dan struktur data lolos pemeriksaan.");
    console.log("Belum ada data yang dikirim atau diubah di Supabase.");
    console.log("\nJika hasil pemeriksaan sudah diverifikasi dan project Supabase siap,");
    console.log("jalankan perintah berikut untuk benar-benar mengimpor data:");
    console.log("npm.cmd run migrate:legacy -- --apply\n");
    return;
  }

  await applyMigration(data);
}

main().catch((error) => {
  console.error("\n[MIGRASI GAGAL]");
  console.error(error?.message || error);
  process.exitCode = 1;
});
