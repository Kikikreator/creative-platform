"use client";

import { useEffect, useMemo, useState } from "react";
import { MapPin, RefreshCw } from "lucide-react";

type RegionOption = {
  id: string;
  name: string;
};

type RegionApiResponse = {
  data?: RegionOption[];
};

type Props = {
  province: string;
  regency: string;
  onProvinceChange: (value: string) => void;
  onRegencyChange: (value: string) => void;
  required?: boolean;
  labelClassName?: string;
  fieldClassName?: string;
  selectClassName?: string;
  iconClassName?: string;
  helperClassName?: string;
  withIcon?: boolean;
};

const API_BASE = "https://www.emsifa.com/api-wilayah-indonesia/v2";

let provincesRequest: Promise<RegionOption[]> | null = null;
const regenciesRequests = new Map<string, Promise<RegionOption[]>>();

async function fetchRegionList(url: string): Promise<RegionOption[]> {
  const response = await fetch(url, { cache: "force-cache" });
  if (!response.ok) {
    throw new Error(`Data wilayah tidak dapat dimuat (HTTP ${response.status}).`);
  }

  const result = (await response.json()) as RegionApiResponse;
  if (!Array.isArray(result.data)) {
    throw new Error("Format data wilayah tidak sesuai.");
  }

  return result.data
    .filter((item) => item && typeof item.id === "string" && typeof item.name === "string")
    .sort((a, b) => a.name.localeCompare(b.name, "id-ID"));
}

function getProvinces() {
  if (!provincesRequest) {
    provincesRequest = fetchRegionList(`${API_BASE}/provinces.json`).catch((error) => {
      provincesRequest = null;
      throw error;
    });
  }
  return provincesRequest;
}

function getRegencies(provinceId: string) {
  const cached = regenciesRequests.get(provinceId);
  if (cached) return cached;

  const request = fetchRegionList(`${API_BASE}/regencies/${encodeURIComponent(provinceId)}.json`).catch((error) => {
    regenciesRequests.delete(provinceId);
    throw error;
  });
  regenciesRequests.set(provinceId, request);
  return request;
}

const defaultLabelClass = "mb-1.5 block text-xs font-medium text-slate-700";
const defaultFieldClass = "relative";
const defaultSelectClass =
  "mt-1.5 block min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400";

export default function IndonesiaRegionSelect({
  province,
  regency,
  onProvinceChange,
  onRegencyChange,
  required = false,
  labelClassName = defaultLabelClass,
  fieldClassName = defaultFieldClass,
  selectClassName = defaultSelectClass,
  iconClassName = "pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400",
  helperClassName = "mt-1.5 text-[11px] leading-5 text-slate-500",
  withIcon = false,
}: Props) {
  const [provinces, setProvinces] = useState<RegionOption[]>([]);
  const [regencies, setRegencies] = useState<RegionOption[]>([]);
  const [provinceLoading, setProvinceLoading] = useState(true);
  const [regencyLoading, setRegencyLoading] = useState(false);
  const [provinceError, setProvinceError] = useState("");
  const [regencyError, setRegencyError] = useState("");
  const [provinceRetry, setProvinceRetry] = useState(0);
  const [regencyRetry, setRegencyRetry] = useState(0);

  const selectedProvince = useMemo(
    () => provinces.find((item) => item.name === province) ?? null,
    [provinces, province],
  );

  useEffect(() => {
    let active = true;
    setProvinceLoading(true);
    setProvinceError("");

    void getProvinces()
      .then((rows) => {
        if (active) setProvinces(rows);
      })
      .catch((error: unknown) => {
        if (active) {
          setProvinceError(error instanceof Error ? error.message : "Data provinsi gagal dimuat.");
        }
      })
      .finally(() => {
        if (active) setProvinceLoading(false);
      });

    return () => {
      active = false;
    };
  }, [provinceRetry]);

  useEffect(() => {
    if (!selectedProvince) {
      setRegencies([]);
      setRegencyError("");
      setRegencyLoading(false);
      return;
    }

    let active = true;
    setRegencies([]);
    setRegencyLoading(true);
    setRegencyError("");

    void getRegencies(selectedProvince.id)
      .then((rows) => {
        if (active) setRegencies(rows);
      })
      .catch((error: unknown) => {
        if (active) {
          setRegencyError(error instanceof Error ? error.message : "Data kabupaten/kota gagal dimuat.");
        }
      })
      .finally(() => {
        if (active) setRegencyLoading(false);
      });

    return () => {
      active = false;
    };
  }, [selectedProvince, regencyRetry]);

  function renderFieldIcon() {
    return withIcon ? <MapPin size={15} className={iconClassName} aria-hidden="true" /> : null;
  }

  return (
    <div className="space-y-3">
      <div>
        <label className={labelClassName} htmlFor="region-province">
          Provinsi {required && <span className="text-rose-500">*</span>}
        </label>
        <div className={fieldClassName}>
          {renderFieldIcon()}
          <select
            id="region-province"
            value={province}
            required={required}
            disabled={provinceLoading || Boolean(provinceError)}
            onChange={(event) => {
              const selected = provinces.find((item) => item.name === event.target.value);
              onProvinceChange(selected?.name ?? "");
              onRegencyChange("");
            }}
            className={selectClassName}
          >
            <option value="">
              {provinceLoading ? "Memuat provinsi..." : "Pilih provinsi"}
            </option>
            {provinces.map((item) => (
              <option key={item.id} value={item.name}>{item.name}</option>
            ))}
          </select>
        </div>
        {provinceError && (
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-rose-600" role="alert">
            <span>{provinceError}</span>
            <button type="button" onClick={() => setProvinceRetry((value) => value + 1)} className="inline-flex items-center gap-1 font-semibold underline">
              <RefreshCw size={11} /> Coba lagi
            </button>
          </div>
        )}
      </div>

      <div>
        <label className={labelClassName} htmlFor="region-regency">
          Kabupaten/Kota {(required || Boolean(province)) && <span className="text-rose-500">*</span>}
        </label>
        <div className={fieldClassName}>
          {renderFieldIcon()}
          <select
            id="region-regency"
            value={regency}
            required={required || Boolean(province)}
            disabled={!selectedProvince || regencyLoading || Boolean(regencyError)}
            onChange={(event) => onRegencyChange(event.target.value)}
            className={selectClassName}
          >
            <option value="">
              {!province
                ? "Pilih provinsi terlebih dahulu"
                : regencyLoading
                  ? "Memuat kabupaten/kota..."
                  : "Pilih kabupaten/kota"}
            </option>
            {regencies.map((item) => (
              <option key={item.id} value={item.name}>{item.name}</option>
            ))}
          </select>
        </div>
        {regencyError && (
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-rose-600" role="alert">
            <span>{regencyError}</span>
            <button type="button" onClick={() => setRegencyRetry((value) => value + 1)} className="inline-flex items-center gap-1 font-semibold underline">
              <RefreshCw size={11} /> Coba lagi
            </button>
          </div>
        )}
        {!regencyError && (
          <p className={helperClassName}>
            Pilih provinsi terlebih dahulu. Daftar kabupaten/kota akan menyesuaikan provinsi yang dipilih.
          </p>
        )}
      </div>
    </div>
  );
}
