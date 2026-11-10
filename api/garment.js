import { createClient } from "@supabase/supabase-js";
import {
  getAdminClient, getAnonClient, getEnv, requireProfile, unwrap,
  normalizeUsername, normalizeDate, legacyId, jakartaNow, syntheticAuthEmail
} from "./_lib/supabase.js";

function fail(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  throw error;
}
function num(value) {
  const result = Number(value);
  return Number.isFinite(result) ? result : 0;
}
function round(value) {
  return Math.round(num(value));
}
function parseArray(value, raw, fallback = []) {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed;
    } catch (_) {}
  }
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    } catch (_) {}
  }
  return fallback;
}
function asText(value, fallback = "") {
  return value === null || value === undefined || value === "" ? fallback : String(value);
}
async function getAll(admin, table, orderColumn) {
  let query = admin.from(table).select("*");
  if (orderColumn) query = query.order(orderColumn, { ascending: true });
  return (await unwrap(query)) || [];
}

async function getLegacyData(admin) {
  const [
    clients, resellers, orders, settings, profiles, attendance, kasbon,
    payroll, hpp, expenses, categories
  ] = await Promise.all([
    getAll(admin, "clients", "legacy_row_order"),
    getAll(admin, "resellers", "legacy_row_order"),
    getAll(admin, "orders", "legacy_row_order"),
    getAll(admin, "settings", "order_index"),
    getAll(admin, "profiles", "legacy_row_order"),
    getAll(admin, "attendance", "legacy_row_order"),
    getAll(admin, "kasbon", "legacy_row_order"),
    getAll(admin, "payroll", "legacy_row_order"),
    getAll(admin, "hpp", "legacy_row_order"),
    getAll(admin, "operational_expenses", "legacy_row_order"),
    getAll(admin, "expense_categories", "legacy_row_order")
  ]);

  const clientsArr = clients.map(r => ({
    id: r.id, nama: r.name || "", asal: r.institution || "", wa: r.whatsapp || ""
  }));
  const resellersArr = resellers.map(r => ({
    id: r.id, nama: r.name || "", asal: r.institution || "", wa: r.whatsapp || ""
  }));

  const ordersArr = orders.map(r => {
    const items = parseArray(r.items, r.items_json_raw, [{
      tipe: r.items_json_raw || "", qty: num(r.total_pcs),
      harga_satuan: num(r.total_pcs) > 0 ? Math.round(num(r.total_price) / num(r.total_pcs)) : 0,
      total: num(r.total_price)
    }]);
    return {
      id: r.id, tgl_masuk: r.order_date || "", id_klien: r.client_id || "",
      id_reseller: r.reseller_id || "", judul: r.title || "", tipe: "Multi-Item",
      items, qty: num(r.total_pcs), keterangan: r.description || "",
      deadline: r.deadline || "", status: r.status || "", harga: num(r.total_price),
      dp: num(r.dp), sisa: num(r.remaining_bill), fee_per_pcs: num(r.fee_per_piece)
    };
  });

  const settingsData = {
    tipe_pakaian: settings.filter(x => x.key === "Tipe_Pakaian").map(x => x.value),
    upah_pekerjaan: settings.filter(x => x.key === "Upah_Pekerjaan").map(x => ({
      nama: x.value, harga: num(x.wage_price)
    })),
    jabatan: settings.filter(x => x.key === "Jabatan").map(x => x.value)
  };

  const usersArr = profiles.map(r => ({
    id: r.legacy_user_id, username: r.username, role: r.role,
    nama: r.full_name || r.username, jabatan: r.position || "-"
  }));

  const absensiArr = attendance.map(r => ({
    id: r.id, tanggal: r.date || "", username: r.username || "",
    nama: r.employee_name || "", status: r.status || "",
    jam_masuk: r.time_in || "-", jam_pulang: r.time_out || "-",
    terlambat: num(r.late_minutes), lembur: r.overtime_status || "-",
    lok_masuk: r.location_in || "-", lok_pulang: r.location_out || "-",
    catatan: r.note || ""
  }));

  const kasbonArr = kasbon.map(r => ({
    id: r.id, tanggal: r.date || "", nama: r.employee_name || "",
    pekerjaan: parseArray(r.work_items, r.work_items_json_raw, [{
      nama: r.work_items_json_raw || "", qty: 1, harga: num(r.total_wage), total: num(r.total_wage)
    }]),
    total: num(r.total_wage), kasbon: num(r.advance_amount), sisa: num(r.remaining_wage)
  }));

  const gajiArr = payroll.map(r => ({
    id: r.id, tanggal: r.date || "", nama: r.employee_name || "",
    jabatan: r.position || "", gaji: num(r.base_salary), bonus: num(r.bonus),
    kasbon: num(r.advance), potongan: num(r.deduction), total: num(r.total_received)
  }));

  const hppArr = hpp.map(r => ({
    id: r.id, id_order: r.order_id, index_item: num(r.item_index),
    nama_item: r.item_name || "", qty: num(r.order_qty),
    komponen: parseArray(r.cost_components, r.cost_components_json_raw, []),
    total_hpp: num(r.total_hpp), hpp_per_pcs: num(r.hpp_per_piece),
    total_penjualan: num(r.total_sales), laba_kotor: num(r.gross_profit),
    margin: num(r.margin_percent), status: r.status || "Draft", updated_at: r.updated_at || ""
  }));

  const biayaArr = expenses.map(r => ({
    id: r.id, tanggal: r.date || "", keterangan: r.description || "",
    kategori: r.category || "", nominal: num(r.amount), catatan: r.note || "",
    created_at: r.created_at || ""
  }));

  const kategoriArr = categories.map(r => ({
    id: r.id, nama: r.name || "", created_at: r.created_at || ""
  }));

  return {
    status: "success",
    clients: clientsArr,
    resellers: resellersArr,
    orders: ordersArr,
    settings: settingsData,
    absensi: absensiArr,
    users: usersArr,
    kasbon: kasbonArr,
    gaji: gajiArr,
    hpp: hppArr,
    biaya_operasional: biayaArr,
    kategori_biaya: kategoriArr
  };
}

async function login(admin, payload) {
  const username = String(payload?.username || "").trim();
  const password = String(payload?.password || "").trim();
  if (!username || !password) {
    return { status: "error", message: "Username dan Password wajib diisi!" };
  }

  const profile = await unwrap(
    admin.from("profiles").select("*")
      .eq("username_normalized", normalizeUsername(username))
      .eq("is_active", true).maybeSingle()
  );

  if (!profile?.auth_email) {
    return { status: "error", message: "Username atau Password Salah!" };
  }

  const authClient = getAnonClient();
  const { data, error } = await authClient.auth.signInWithPassword({
    email: profile.auth_email,
    password
  });

  if (error || !data?.session) {
    return { status: "error", message: "Username atau Password Salah!" };
  }

  const appData = await getLegacyData(admin);
  return {
    ...appData,
    status: "success",
    role: profile.role,
    username: profile.username,
    legacy_username: profile.username,
    nama_lengkap: profile.full_name || profile.username,
    jabatan: profile.position || "-",
    auth_session: {
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      expires_in: data.session.expires_in,
      expires_at: data.session.expires_at
    }
  };
}

async function replaceSettings(admin, key, values) {
  const payload = (values || []).map((item, index) => {
    if (key === "Upah_Pekerjaan") {
      return { value: String(item?.nama || ""), wage_price: num(item?.harga), order_index: index + 1 };
    }
    return { value: String(item || ""), wage_price: null, order_index: index + 1 };
  });
  await unwrap(admin.rpc("replace_settings_by_key", { p_key: key, p_values: payload }));
  return { status: "success" };
}


async function addUser(admin, payload) {
  const p = payload?.data || {};
  const username = String(p.username || "").trim();
  const password = String(p.password || "").trim();

  if (!username) fail("Username wajib diisi.");
  if (!password) fail("Password wajib diisi.");

  const usernameNormalized = normalizeUsername(username);
  const existing = await unwrap(
    admin.from("profiles").select("id")
      .eq("username_normalized", usernameNormalized).maybeSingle()
  );
  if (existing) fail("Username sudah digunakan.", 409);

  const id = legacyId("U-");
  const authEmail = syntheticAuthEmail(id);

  const { data, error } = await admin.auth.admin.createUser({
    email: authEmail,
    password,
    email_confirm: true,
    user_metadata: { legacy_user_id: id, username }
  });
  if (error) throw error;

  const profile = {
    id: data.user.id,
    legacy_user_id: id,
    username,
    username_normalized: usernameNormalized,
    role: String(p.role || "Karyawan"),
    full_name: String(p.nama || username),
    position: String(p.jabatan || "-"),
    auth_email: authEmail,
    is_active: true,
    legacy_row_order: Date.now()
  };

  const { error: profileError } = await admin.from("profiles").insert(profile);
  if (profileError) {
    await admin.auth.admin.deleteUser(data.user.id);
    throw profileError;
  }

  return { status: "success", newId: id };
}


async function editUser(admin, payload) {
  const p = payload?.data || {};
  const profile = await unwrap(
    admin.from("profiles").select("*")
      .eq("legacy_user_id", String(payload?.id || "")).maybeSingle()
  );
  if (!profile) fail("Pengguna tidak ditemukan.", 404);

  const username = String(p.username ?? profile.username ?? "").trim();
  if (!username) fail("Username wajib diisi.");

  const usernameNormalized = normalizeUsername(username);
  const duplicate = await unwrap(
    admin.from("profiles").select("id")
      .eq("username_normalized", usernameNormalized)
      .neq("id", profile.id)
      .maybeSingle()
  );
  if (duplicate) fail("Username sudah digunakan.", 409);

  const password = String(p.password || "").trim();
  const authUpdates = {
    user_metadata: {
      legacy_user_id: profile.legacy_user_id,
      username
    }
  };
  if (password) authUpdates.password = password;

  const { error: authError } = await admin.auth.admin.updateUserById(
    profile.id,
    authUpdates
  );
  if (authError) throw authError;

  await unwrap(
    admin.from("profiles").update({
      username,
      username_normalized: usernameNormalized,
      role: String(p.role || profile.role),
      full_name: String(p.nama || profile.full_name || username),
      position: String(p.jabatan || "-")
    }).eq("id", profile.id)
  );

  return { status: "success" };
}

async function deleteUser(admin, payload) {
  const profile = await unwrap(admin.from("profiles").select("id")
    .eq("legacy_user_id", String(payload?.id || "")).maybeSingle());
  if (!profile) fail("Pengguna tidak ditemukan.", 404);
  const { error } = await admin.auth.admin.deleteUser(profile.id);
  if (error) throw error;
  return { status: "success" };
}

async function saveHPP(admin, payload) {
  const p = payload?.data || {};
  const idOrder = String(p.id_order || "").trim();
  const indexItem = Number(p.index_item) || 0;
  const namaItem = String(p.nama_item || "").trim();
  const qty = num(p.qty);
  const totalPenjualan = num(p.total_penjualan);
  if (!idOrder) fail("ID Order tidak ditemukan.");
  if (!namaItem) fail("Nama item tidak ditemukan.");

  const components = [];
  let totalHPP = 0;
  for (const input of (Array.isArray(p.komponen) ? p.komponen : [])) {
    const item = input || {};
    const nama = String(item.nama || "").trim();
    if (!nama) continue;
    const qtyKomponen = num(item.qty);
    const harga = num(item.harga);
    const jumlah = round(qtyKomponen * harga);
    components.push({
      nama, meter_yard: String(item.meter_yard || ""),
      qty: qtyKomponen, harga, jumlah
    });
    totalHPP += jumlah;
  }
  totalHPP = round(totalHPP);
  const hppPerPcs = qty > 0 ? round(totalHPP / qty) : 0;
  const labaKotor = round(totalPenjualan - totalHPP);
  const margin = totalPenjualan > 0
    ? Math.round((labaKotor / totalPenjualan) * 10000) / 100
    : 0;
  const status = components.length > 0 ? "Selesai" : "Draft";
  const updatedAt = jakartaNow().timestamp;

  const existing = await unwrap(admin.from("hpp").select("id")
    .eq("order_id", idOrder).eq("item_index", indexItem).limit(1));
  const id = existing?.[0]?.id || `HPP-${Date.now().toString().slice(-8)}`;
  const row = {
    id, order_id: idOrder, item_index: indexItem, item_name: namaItem, legacy_row_order: Date.now(),
    order_qty: qty, cost_components: components,
    cost_components_json_raw: JSON.stringify(components),
    total_hpp: totalHPP, hpp_per_piece: hppPerPcs,
    total_sales: totalPenjualan, gross_profit: labaKotor,
    margin_percent: margin, status, updated_at: updatedAt
  };
  await unwrap(admin.from("hpp").upsert(row, { onConflict: "id" }));
  return {
    status: "success",
    message: existing?.length ? "HPP berhasil diperbarui." : "HPP berhasil disimpan.",
    data: {
      id, id_order: idOrder, index_item: indexItem,
      total_hpp: totalHPP, hpp_per_pcs: hppPerPcs,
      total_penjualan: totalPenjualan, laba_kotor: labaKotor,
      margin, status
    }
  };
}

async function runAction(admin, action, payload) {
  const p = payload || {};
  const d = p.data || {};
  const now = jakartaNow();

  switch (action) {
    case "getData":
      return await getLegacyData(admin);

    case "addClient": {
      const id = legacyId("C-");
      await unwrap(admin.from("clients").insert({
        id, name: d.nama || "", institution: d.asal || "", whatsapp: d.wa || "", legacy_row_order: Date.now()
      }));
      return { status: "success", newId: id };
    }
    case "editClient":
      await unwrap(admin.from("clients").update({
        name: d.nama || "", institution: d.asal || "", whatsapp: d.wa || ""
      }).eq("id", p.id));
      return { status: "success" };
    case "deleteClient":
      await unwrap(admin.from("clients").delete().eq("id", p.id));
      return { status: "success" };

    case "addReseller": {
      const id = legacyId("R-");
      await unwrap(admin.from("resellers").insert({
        id, name: d.nama || "", institution: d.asal || "", whatsapp: d.wa || "", legacy_row_order: Date.now()
      }));
      return { status: "success", newId: id };
    }
    case "editReseller":
      await unwrap(admin.from("resellers").update({
        name: d.nama || "", institution: d.asal || "", whatsapp: d.wa || ""
      }).eq("id", p.id));
      return { status: "success" };
    case "deleteReseller":
      await unwrap(admin.from("resellers").delete().eq("id", p.id));
      return { status: "success" };

    case "addOrder": {
      let clientId = d.id_klien || "";
      if (d.isNewClient) {
        clientId = legacyId("C-");
        await unwrap(admin.from("clients").insert({
          id: clientId, name: d.newClientData?.nama || "",
          institution: d.newClientData?.asal || "", whatsapp: "-", legacy_row_order: Date.now()
        }));
      }
      const id = legacyId("O-");
      await unwrap(admin.from("orders").insert({
        id, order_date: now.date, client_id: clientId, legacy_row_order: Date.now(),
        reseller_id: d.id_reseller || null, title: d.judul || "",
        items: Array.isArray(d.items) ? d.items : [],
        items_json_raw: JSON.stringify(d.items || []),
        total_pcs: num(d.qty), description: d.keterangan || "",
        deadline: normalizeDate(d.deadline), status: d.status || "",
        total_price: num(d.harga), dp: num(d.dp),
        remaining_bill: num(d.sisa), fee_per_piece: num(d.fee_per_pcs), legacy_row_order: Date.now()
      }));
      return { status: "success", newId: id };
    }
    case "editOrder": {
      let clientId = d.id_klien || "";
      if (d.isNewClient) {
        clientId = legacyId("C-");
        await unwrap(admin.from("clients").insert({
          id: clientId, name: d.newClientData?.nama || "",
          institution: d.newClientData?.asal || "", whatsapp: "-", legacy_row_order: Date.now()
        }));
      }
      await unwrap(admin.from("orders").update({
        client_id: clientId, reseller_id: d.id_reseller || null,
        title: d.judul || "", items: Array.isArray(d.items) ? d.items : [],
        items_json_raw: JSON.stringify(d.items || []), total_pcs: num(d.qty),
        description: d.keterangan || "", deadline: normalizeDate(d.deadline),
        total_price: num(d.harga), dp: num(d.dp), remaining_bill: num(d.sisa),
        fee_per_piece: num(d.fee_per_pcs)
      }).eq("id", p.id));
      return { status: "success" };
    }
    case "deleteOrder":
      await unwrap(admin.from("orders").delete().eq("id", p.id));
      return { status: "success" };
    case "updateOrderStatus":
      await unwrap(admin.from("orders").update({ status: p.status }).eq("id", p.id));
      return { status: "success" };

    case "updateTipePakaian":
      return await replaceSettings(admin, "Tipe_Pakaian", Array.isArray(d) ? d : []);
    case "updateUpahPekerjaan":
      return await replaceSettings(admin, "Upah_Pekerjaan", Array.isArray(d) ? d : []);
    case "updateJabatan":
      return await replaceSettings(admin, "Jabatan", Array.isArray(d) ? d : []);

    case "updateFee":
      await unwrap(admin.from("orders").update({ fee_per_piece: num(p.fee) }).eq("id", p.id));
      return { status: "success", message: "Fee berhasil diperbarui.", id: p.id, fee: num(p.fee) };

    case "saveHPP":
      return await saveHPP(admin, p);
    case "deleteHPP": {
      const data = p.data || p;
      const idOrder = String(data.id_order || "").trim();
      const indexItem = Number(data.index_item);
      if (!idOrder) fail("ID Order tidak ditemukan.");
      if (Number.isNaN(indexItem)) fail("Index item tidak valid.");
      const deleted = await unwrap(admin.from("hpp").delete()
        .eq("order_id", idOrder).eq("item_index", indexItem).select("id"));
      if (!deleted?.length) fail(`Data HPP tidak ditemukan. ID Order: ${idOrder} | Index Item: ${indexItem}`, 404);
      return { status: "success", message: "HPP berhasil dihapus.", id_order: idOrder, index_item: indexItem };
    }

    case "addBiayaOperasional": {
      const tanggal = normalizeDate(d.tanggal);
      const keterangan = String(d.keterangan || "").trim();
      const nominal = num(d.nominal);
      if (!tanggal) fail("Tanggal biaya wajib diisi.");
      if (!keterangan) fail("Keterangan biaya wajib diisi.");
      if (nominal <= 0) fail("Nominal biaya harus lebih dari 0.");
      const id = `BO-${Date.now().toString().slice(-8)}`;
      await unwrap(admin.from("operational_expenses").insert({
        id, date: tanggal, description: keterangan, legacy_row_order: Date.now(),
        category: String(d.kategori || "Lainnya"),
        amount: nominal, note: String(d.catatan || ""),
        created_at: now.timestamp
      }));
      return { status: "success", message: "Biaya operasional berhasil ditambahkan.", newId: id, id };
    }
    case "editBiayaOperasional": {
      const tanggal = normalizeDate(d.tanggal);
      const keterangan = String(d.keterangan || "").trim();
      const nominal = num(d.nominal);
      if (!p.id) fail("ID biaya tidak ditemukan.");
      if (!tanggal || !keterangan || nominal <= 0) fail("Data biaya belum lengkap.");
      await unwrap(admin.from("operational_expenses").update({
        date: tanggal, description: keterangan,
        category: String(d.kategori || "Lainnya"),
        amount: nominal, note: String(d.catatan || "")
      }).eq("id", p.id));
      return { status: "success", message: "Biaya operasional berhasil diperbarui." };
    }
    case "deleteBiayaOperasional":
      if (!p.id) fail("ID biaya tidak ditemukan.");
      await unwrap(admin.from("operational_expenses").delete().eq("id", p.id));
      return { status: "success", message: "Biaya operasional berhasil dihapus." };

    case "addKategoriBiaya": {
      const nama = String(d.nama || "").trim();
      if (!nama) fail("Nama kategori wajib diisi.");
      const old = await unwrap(admin.from("expense_categories").select("id,name").ilike("name", nama));
      if (old?.length) fail("Kategori tersebut sudah tersedia.");
      const id = `KB-${Date.now().toString().slice(-8)}`;
      await unwrap(admin.from("expense_categories").insert({ id, name: nama, created_at: now.timestamp, legacy_row_order: Date.now() }));
      return { status: "success", id, nama, message: "Kategori berhasil ditambahkan." };
    }
    case "editKategoriBiaya": {
      const id = String(p.id || "").trim();
      const nama = String(d.nama || "").trim();
      if (!id || !nama) fail("Data kategori tidak lengkap.");
      const duplicates = await unwrap(admin.from("expense_categories").select("id,name").ilike("name", nama));
      if (duplicates?.some(x => x.id !== id)) fail("Nama kategori tersebut sudah digunakan.");
      const updated = await unwrap(admin.from("expense_categories").update({ name: nama }).eq("id", id).select("id"));
      if (!updated?.length) fail("Kategori tidak ditemukan.", 404);
      return { status: "success", message: "Kategori berhasil diperbarui." };
    }
    case "deleteKategoriBiaya": {
      const id = String(p.id || "").trim();
      if (!id) fail("ID kategori tidak ditemukan.");
      const deleted = await unwrap(admin.from("expense_categories").delete().eq("id", id).select("id"));
      if (!deleted?.length) fail("Kategori tidak ditemukan.", 404);
      return { status: "success", message: "Kategori berhasil dihapus." };
    }

    case "addUser":
      return await addUser(admin, p);
    case "editUser":
      return await editUser(admin, p);
    case "deleteUser":
      return await deleteUser(admin, p);

    case "absenMasuk": {
      const person = d;
      const name = String(person.nama || "").trim();
      if (!name) fail("Nama karyawan tidak ditemukan.");
      const today = now.date;
      const existing = await unwrap(admin.from("attendance").select("id,employee_name")
        .eq("date", today));
      if (existing.some(x => String(x.employee_name || "").trim().toLowerCase() === name.toLowerCase())) {
        return { status: "error", message: "Anda sudah melakukan absensi hari ini!" };
      }
      const [hour, minute] = now.time.split(":").map(Number);
      const late = hour > 8 || (hour === 8 && minute > 0) ? ((hour - 8) * 60) + minute : 0;
      const id = legacyId("ABS-");
      await unwrap(admin.from("attendance").insert({
        id, date: today, username: p.username || "", legacy_row_order: Date.now(),
        employee_name: name, status: "Hadir", time_in: now.time,
        time_out: "-", late_minutes: late, overtime_status: "-",
        location_in: person.lokasi || "-", location_out: "-",
        note: person.catatan || ""
      }));
      return { status: "success", newId: id, time: now.time, terlambat: late };
    }
    case "absenPulang": {
      const name = String(d.nama || "").trim().toLowerCase();
      const rows = await unwrap(admin.from("attendance").select("*").eq("date", now.date));
      const record = rows.find(x => String(x.employee_name || "").trim().toLowerCase() === name);
      if (!record) return { status: "error", message: "Data absen masuk hari ini tidak ditemukan." };
      if (record.time_out && record.time_out !== "-") {
        return { status: "error", message: "Anda sudah melakukan absen pulang hari ini!" };
      }
      const hour = Number(now.time.slice(0, 2));
      const overtime = hour >= 19 ? "Lembur" : "Normal";
      await unwrap(admin.from("attendance").update({
        time_out: now.time, overtime_status: overtime, location_out: d.lokasi || "-"
      }).eq("id", record.id));
      return { status: "success", time: now.time, lembur: overtime };
    }
    case "absenLapor": {
      const existing = await unwrap(admin.from("attendance").select("id")
        .eq("date", now.date).eq("username", p.username || ""));
      if (existing.length) return { status: "error", message: "Anda sudah memiliki laporan absensi hari ini!" };
      const id = legacyId("ABS-");
      await unwrap(admin.from("attendance").insert({
        id, date: now.date, username: p.username || "", legacy_row_order: Date.now(),
        employee_name: d.nama || "", status: d.status || "Tidak Hadir",
        time_in: "-", time_out: "-", late_minutes: 0, overtime_status: "-",
        location_in: "-", location_out: "-", note: d.catatan || ""
      }));
      return { status: "success", newId: id };
    }
    case "editAbsensi": {
      const status = d.status || "";
      const jamMasuk = String(d.jam_masuk || "-");
      let late = 0;
      if (status === "Hadir" && jamMasuk !== "-" && jamMasuk.includes(":")) {
        const [h, m] = jamMasuk.split(":").map(x => Number.parseInt(x, 10) || 0);
        const total = h * 60 + m;
        const threshold = 8 * 60 + 10;
        late = total > threshold ? total - threshold : 0;
      }
      const updated = await unwrap(admin.from("attendance").update({
        date: normalizeDate(d.tanggal), status,
        time_in: jamMasuk, time_out: String(d.jam_pulang || "-"),
        late_minutes: late, note: d.catatan || ""
      }).eq("id", p.id).select("id"));
      if (!updated?.length) fail("Data absensi tidak ditemukan.", 404);
      return { status: "success" };
    }
    case "deleteAbsensi":
      await unwrap(admin.from("attendance").delete().eq("id", p.id));
      return { status: "success" };

    case "addKasbon": {
      const id = legacyId("K-");
      await unwrap(admin.from("kasbon").insert({
        id, date: normalizeDate(d.tanggal), employee_name: d.nama || "", legacy_row_order: Date.now(),
        work_items: Array.isArray(d.pekerjaan) ? d.pekerjaan : [],
        work_items_json_raw: JSON.stringify(d.pekerjaan || []),
        total_wage: num(d.total), advance_amount: num(d.kasbon),
        remaining_wage: num(d.sisa)
      }));
      return { status: "success", newId: id };
    }
    case "editKasbon":
      await unwrap(admin.from("kasbon").update({
        date: normalizeDate(d.tanggal), employee_name: d.nama || "",
        work_items: Array.isArray(d.pekerjaan) ? d.pekerjaan : [],
        work_items_json_raw: JSON.stringify(d.pekerjaan || []),
        total_wage: num(d.total), advance_amount: num(d.kasbon),
        remaining_wage: num(d.sisa)
      }).eq("id", p.id));
      return { status: "success" };
    case "deleteKasbon":
      await unwrap(admin.from("kasbon").delete().eq("id", p.id));
      return { status: "success" };

    case "addGaji": {
      const id = legacyId("G-");
      await unwrap(admin.from("payroll").insert({
        id, date: normalizeDate(d.tanggal), employee_name: d.nama || "", legacy_row_order: Date.now(),
        position: d.jabatan || "", base_salary: num(d.gaji), bonus: num(d.bonus),
        advance: num(d.kasbon), deduction: num(d.potongan), total_received: num(d.total)
      }));
      return { status: "success", newId: id };
    }
    case "editGaji":
      await unwrap(admin.from("payroll").update({
        date: normalizeDate(d.tanggal), employee_name: d.nama || "",
        position: d.jabatan || "", base_salary: num(d.gaji), bonus: num(d.bonus),
        advance: num(d.kasbon), deduction: num(d.potongan), total_received: num(d.total)
      }).eq("id", p.id));
      return { status: "success" };
    case "deleteGaji":
      await unwrap(admin.from("payroll").delete().eq("id", p.id));
      return { status: "success" };

    default:
      return { status: "error", message: `Action tidak dikenal: ${action}` };
  }
}

async function runDirectMethod(admin, method, args) {
  switch (method) {
    case "getMasterTukang": {
      const rows = await getAll(admin, "master_tukang", "order_index");
      return { success: true, data: rows.map(x => x.name).filter(Boolean) };
    }
    case "saveMasterTukangBatch": {
      const raw = Array.isArray(args[0]) ? args[0] : [];
      const seen = new Set();
      const names = raw.map(x => String(x || "").trim()).filter(Boolean).filter(name => {
        const key = name.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      await unwrap(admin.rpc("replace_master_tukang", { p_names: names }));
      return { success: true, message: "Master Tukang berhasil disimpan.", data: names };
    }
    case "getInvestorData": {
      const rows = await getAll(admin, "investor_records", "legacy_row_order");
      return { success: true, data: rows.filter(x => x.payload !== null).map(x => x.payload) };
    }
    case "saveInvestorData":
      await unwrap(admin.from("investor_records").insert({
        id: `INV-${Date.now()}`, created_at: jakartaNow().timestamp, legacy_row_order: Date.now(),
        payload: args[0] || {}, raw_payload: JSON.stringify(args[0] || {})
      }));
      return { success: true };
    case "saveInvestorDataBatch": {
      const records = (Array.isArray(args[0]) ? args[0] : []).map((payload, index) => ({
        id: `INV-${Date.now()}-${index}`,
        created_at: jakartaNow().timestamp, legacy_row_order: index + 1,
        payload,
        raw_payload: JSON.stringify(payload)
      }));
      await unwrap(admin.rpc("replace_investor_records", { p_rows: records }));
      return { success: true };
    }
    case "getInvestorProjectData": {
      const rows = await getAll(admin, "investor_projects", "order_index");
      return {
        success: true,
        data: rows.map(row => ({
          date: row.investment_date || "",
          returnDate: row.return_date || "",
          nama: row.investor_name || "",
          nominal: num(row.principal_amount),
          dividen: num(row.dividend),
          totalKembali: num(row.total_return)
        }))
      };
    }
    case "saveInvestorProjectBatch": {
      const raw = Array.isArray(args[0]) ? args[0] : [];
      const rows = raw.filter(x => x && typeof x === "object").map((record, index) => {
        const nominal = num(record.nominal);
        const dividen = nominal * 0.10;
        const total = nominal + dividen;
        const date = normalizeDate(record.date);
        let returnDate = null;
        if (date) {
          const [year, month, day] = date.split("-").map(Number);
          const d = new Date(Date.UTC(year, month - 1, day));
          d.setUTCMonth(d.getUTCMonth() + 2);
          returnDate = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
        }
        return {
          id: `IP-${Date.now()}-${index}`,
          investment_date: date,
          return_date: returnDate,
          investor_name: record.nama || "",
          principal_amount: nominal,
          dividend: dividen,
          total_return: total,
          order_index: index + 1
        };
      });
      await unwrap(admin.rpc("replace_investor_projects", { p_rows: rows }));
      return {
        success: true,
        message: "Data Investor Project berhasil disimpan.",
        data: rows.map(row => ({
          date: row.investment_date || "",
          returnDate: row.return_date || "",
          nama: row.investor_name,
          nominal: row.principal_amount,
          dividen: row.dividend,
          totalKembali: row.total_return
        }))
      };
    }
    default:
      return null;
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ message: "Method tidak diizinkan." });

  try {
    const admin = getAdminClient();
    const method = String(req.body?.method || "");
    const args = Array.isArray(req.body?.args) ? req.body.args : [];

    if (method === "processFrontendRequest") {
      let request;
      try {
        request = JSON.parse(String(args[0] || "{}"));
      } catch (_) {
        return res.status(400).json({ message: "Format permintaan frontend tidak valid." });
      }

      const action = String(request.action || "");
      if (action === "login") {
        const result = await login(admin, request.payload || {});
        return res.status(200).json({ result });
      }

      const profile = await requireProfile(req, admin);
      const result = await runAction(admin, action, request.payload || {}, profile);
      return res.status(200).json({ result });
    }

    const profile = await requireProfile(req, admin);
    const directResult = await runDirectMethod(admin, method, args, profile);
    if (directResult !== null) return res.status(200).json({ result: directResult });

    return res.status(404).json({ message: `Method backend tidak dikenal: ${method}` });
  } catch (error) {
    console.error("[Garment API]", error);
    const status = error.status || 500;
    return res.status(status).json({
      message: status === 500 ? "Terjadi kesalahan pada server Garment Padang." : error.message,
      result: { status: "error", message: error.message || "Permintaan gagal." }
    });
  }
}
