import { connection } from "next/server";
import { redirect, notFound } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { getPrimaryRole, normalizeRoles } from "@/lib/auth/roles";
import CheckoutManager, {
  type CheckoutCourse,
  type CheckoutOrder,
  type CheckoutPayment,
  type CheckoutPaymentMethod,
  type CheckoutProfile,
} from "./checkout-manager";

type PageProps = {
  searchParams: Promise<{
    course?: string | string[];
  }>;
};

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function CheckoutPage({
  searchParams,
}: PageProps) {
  await connection();

  const params = await searchParams;

  const courseId = Array.isArray(params.course)
    ? params.course[0]
    : params.course;

  if (!courseId || !UUID_REGEX.test(courseId)) {
    redirect("/kelas");
  }

  const supabase = await createClient();

  // ==========================================
  // AUTHENTICATION
  // ==========================================

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect(
      `/register?course=${encodeURIComponent(courseId)}`
    );
  }

  // Checkout hanya boleh digunakan oleh akun Peserta.
  const { data: roleRows, error: roleError } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id);

  if (roleError) {
    throw new Error(`Gagal memeriksa hak akses checkout: ${roleError.message}`);
  }

  const primaryRole = getPrimaryRole(normalizeRoles(roleRows));
  if (primaryRole === "admin") redirect("/admin");
  if (primaryRole === "instructor") redirect("/mentor");
  if (primaryRole !== "member") redirect("/login?reason=role-unassigned");

  // ==========================================
  // COURSE
  // ==========================================

  const {
    data: course,
    error: courseError,
  } = await supabase
    .from("courses")
    .select(`
      id,
      title,
      slug,
      short_description,
      cover_image_url,
      category,
      price
    `)
    .eq("id", courseId)
    .eq("status", "published")
    .maybeSingle();

  if (courseError) {
    return (
      <CheckoutManager
        initialCourse={null}
        initialOrder={null}
        initialPayment={null}
        initialPaymentMethods={[]}
        initialProfile={null}
        userId={user.id}
        userEmail={user.email ?? ""}
        initialError={courseError.message}
      />
    );
  }

  if (!course) {
    notFound();
  }

  // ==========================================
  // CREATE OR GET EXISTING ORDER
  // ==========================================

  const {
    data: orderRows,
    error: orderCreationError,
  } = await supabase.rpc("create_course_order", {
    p_course_id: courseId,
  });

  const createdOrder = orderRows?.[0];

  if (orderCreationError || !createdOrder) {
    return (
      <CheckoutManager
        initialCourse={course as CheckoutCourse}
        initialOrder={null}
        initialPayment={null}
        initialPaymentMethods={[]}
        initialProfile={null}
        userId={user.id}
        userEmail={user.email ?? ""}
        initialError={
          orderCreationError?.message ??
          "Invoice tidak berhasil dibuat."
        }
      />
    );
  }

  const orderId = createdOrder.result_order_id;

  // ==========================================
  // LOAD CHECKOUT DATA
  // ==========================================

  const [
    orderResult,
    paymentResult,
    methodsResult,
    profileResult,
  ] = await Promise.all([
    supabase
      .from("orders")
      .select(`
        id,
        invoice_number,
        status,
        subtotal,
        discount,
        total,
        currency,
        promo_code_id,
        promo_code
      `)
      .eq("id", orderId)
      .eq("user_id", user.id)
      .maybeSingle(),

    supabase
      .from("payments")
      .select(`
        id,
        order_id,
        payment_method_id,
        amount,
        proof_path,
        status,
        rejection_reason,
        created_at
      `)
      .eq("order_id", orderId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),

    supabase
      .from("payment_methods")
      .select(`
        id,
        name,
        bank_name,
        account_name,
        account_number,
        qr_image_path,
        instructions,
        is_active,
        position
      `)
      .eq("is_active", true)
      .order("position", { ascending: true }),

    supabase
      .from("profiles")
      .select("id, full_name, phone")
      .eq("id", user.id)
      .maybeSingle(),
  ]);

  // ==========================================
// REDIRECT KE HALAMAN STATUS PEMBAYARAN
// ==========================================

const currentOrderStatus =
  orderResult.data?.status ?? createdOrder.result_status;

const currentPaymentStatus =
  paymentResult.data?.status ?? null;

if (
  currentOrderStatus === "waiting_verification" ||
  currentOrderStatus === "paid" ||
  currentPaymentStatus === "waiting_verification" ||
  currentPaymentStatus === "approved"
) {
  redirect(`/checkout/${orderId}`);
}

  // Gunakan hasil RPC sebagai fallback jika SELECT order
  // tidak dapat membaca data karena kebijakan akses.
  // Fallback ini tidak dapat memulihkan detail promo; karena itu,
  // SELECT orders tetap perlu dapat dibaca oleh pemilik invoice.
  const initialOrder: CheckoutOrder =
    (orderResult.data as CheckoutOrder | null) ?? {
      id: orderId,
      invoice_number: createdOrder.result_invoice_number,
      status: createdOrder.result_status,
      subtotal: createdOrder.result_amount,
      discount: 0,
      total: createdOrder.result_amount,
      currency: "IDR",
      promo_code_id: null,
      promo_code: null,
    };

  const initialError = [
    orderResult.error?.message,
    paymentResult.error?.message,
    methodsResult.error?.message,
  ]
    .filter(Boolean)
    .join(" | ") || null;

  return (
    <CheckoutManager
      initialCourse={course as CheckoutCourse}
      initialOrder={initialOrder}
      initialPayment={
        (paymentResult.data as CheckoutPayment | null) ?? null
      }
      initialPaymentMethods={
        (methodsResult.data ?? []) as CheckoutPaymentMethod[]
      }
      initialProfile={
        (profileResult.data as CheckoutProfile | null) ?? null
      }
      userId={user.id}
      userEmail={user.email ?? ""}
      initialError={initialError}
    />
  );
}
