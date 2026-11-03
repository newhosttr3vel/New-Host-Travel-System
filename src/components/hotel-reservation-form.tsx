"use client";

import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Plus, Trash2, X, Save, BedDouble, CalendarDays, FileText, Building2, Wallet } from "lucide-react";
import type { Locale } from "@/lib/messages";

type CustomerOption = { id: string; name: string; companyName?: string | null; type: "INDIVIDUAL" | "CORPORATE"; nationality?: string | null };
type SupplierOption = { id: string; name: string; category: string };
type HotelOption = { id: string; name: string; city?: string | null; country?: string | null };
type NightRate = {
  stayDate: string;
  saleRoomRate: string;
  saleMealRatePerPax: string;
  saleVat: string;
  costRoomRate: string;
  costMealRatePerPax: string;
  costVat: string;
};
type RoomLine = {
  id?: string;
  key: string;
  roomCount: number;
  roomType: string;
  mealPlan: string;
  adults: number;
  children: number;
  rates: NightRate[];
};
type HotelDetail = {
  clientNationality: string;
  guestName: string;
  guestNationality: string;
  guestPhone: string;
  rateCode: string;
  clientOptionDate: string;
  hotelOptionDate: string;
  termsAndConditions: string;
  generalPolicy: string;
  tags: string[];
  fileNo: string;
  reservationRemarks: string;
  roomNumber: string;
  hotelConfirmationNumber: string;
  voucher: string;
  referenceNumber: string;
  detailRemarks: string;
  agreementNumber: string;
  costCenter: string;
  hotelRemarks: string;
  company: string;
  subClient: string;
  salesperson: string;
  channel: string;
  clientRemarks: string;
  bank: string;
  paymentMethod: string;
  isManualRate: boolean;
  pricesIncludeVat: boolean;
};
type HotelRoomSaved = {
  id: string;
  roomCount: number;
  roomType: string;
  mealPlan: string;
  adults: number;
  children: number;
  nightlyRates: Array<{
    stayDate: string;
    saleRoomRate: string;
    saleMealRatePerPax: string;
    saleVat: string;
    costRoomRate: string | null;
    costMealRatePerPax: string | null;
    costVat: string | null;
  }>;
};
type ExistingHotelDetail = Partial<{
  [Key in keyof HotelDetail as HotelDetail[Key] extends string ? Key : never]: string | null;
}> & {
  hotelId?: string | null;
  hotelName?: string | null;
  tags?: string[];
  isManualRate?: boolean;
  pricesIncludeVat?: boolean;
  rooms: HotelRoomSaved[];
};
type ExistingReservation = {
  id: string;
  reference: string;
  serviceType: string;
  startDate: string | null;
  endDate: string | null;
  currency: string;
  saleAmount: string;
  costAmount: string | null;
  notes: string | null;
  customer: { id: string; name: string; type?: string; nationality?: string | null };
  supplier: { id: string; name: string; category?: string } | null;
  hotelDetail: ExistingHotelDetail | null;
};
type Props = {
  locale: Locale;
  canReadCosts: boolean;
  customers: CustomerOption[];
  suppliers: SupplierOption[];
  hotels: HotelOption[];
  initialReservation: ExistingReservation | null;
  draft?: { customerId?: string; startDate?: string; endDate?: string; currency?: string };
  companyName: string;
  onCancel: () => void;
  onSaved: (message: string) => void;
};

const emptyRate = (stayDate: string): NightRate => ({
  stayDate,
  saleRoomRate: "0.00",
  saleMealRatePerPax: "0.00",
  saleVat: "0.00",
  costRoomRate: "0.00",
  costMealRatePerPax: "0.00",
  costVat: "0.00",
});

const emptyDetail = (companyName: string): HotelDetail => ({
  clientNationality: "",
  guestName: "",
  guestNationality: "Egyptian",
  guestPhone: "",
  rateCode: "",
  clientOptionDate: "",
  hotelOptionDate: "",
  termsAndConditions: "",
  generalPolicy: "",
  tags: [],
  fileNo: "",
  reservationRemarks: "",
  roomNumber: "",
  hotelConfirmationNumber: "",
  voucher: "",
  referenceNumber: "",
  detailRemarks: "",
  agreementNumber: "",
  costCenter: "",
  hotelRemarks: "",
  company: companyName,
  subClient: "",
  salesperson: "",
  channel: "",
  clientRemarks: "",
  bank: "",
  paymentMethod: "CASH",
  isManualRate: false,
  pricesIncludeVat: false,
});

function nightsBetween(start: string, end: string): string[] {
  if (!start || !end) return [];
  const startTime = new Date(start + "T00:00:00.000Z").getTime();
  const endTime = new Date(end + "T00:00:00.000Z").getTime();
  if (!Number.isFinite(startTime) || !Number.isFinite(endTime) || endTime <= startTime) return [];
  const count = Math.min(365, Math.floor((endTime - startTime) / 86_400_000));
  return Array.from({ length: count }, (_, index) => new Date(startTime + index * 86_400_000).toISOString().slice(0, 10));
}

function normalizeDate(value: string | null | undefined): string {
  return value ? new Date(value).toISOString().slice(0, 10) : "";
}

function buildRoom(room?: HotelRoomSaved, dates: string[] = [], index = 0): RoomLine {
  const savedRates = new Map((room?.nightlyRates ?? []).map((rate) => [normalizeDate(rate.stayDate), rate]));
  return {
    id: room?.id,
    key: `room-${index}-${Math.random().toString(36).slice(2, 8)}`,
    roomCount: room?.roomCount ?? 1,
    roomType: room?.roomType ?? "",
    mealPlan: room?.mealPlan ?? "BB",
    adults: room?.adults ?? 1,
    children: room?.children ?? 0,
    rates: dates.map((date) => {
      const saved = savedRates.get(date);
      return {
        stayDate: date,
        saleRoomRate: saved?.saleRoomRate ?? "0.00",
        saleMealRatePerPax: saved?.saleMealRatePerPax ?? "0.00",
        saleVat: saved?.saleVat ?? "0.00",
        costRoomRate: saved?.costRoomRate ?? "0.00",
        costMealRatePerPax: saved?.costMealRatePerPax ?? "0.00",
        costVat: saved?.costVat ?? "0.00",
      };
    }),
  };
}

function amountToCents(value: string | null | undefined): bigint {
  const raw = (value ?? "0").trim();
  if (!/^\d+(?:\.\d{0,2})?$/.test(raw)) return 0n;
  const [whole, fraction = ""] = raw.split(".");
  return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0") || "0");
}
function centsToAmount(value: bigint): string {
  const normalized = value < 0n ? -value : value;
  return (value < 0n ? "-" : "") + (normalized / 100n).toString() + "." + (normalized % 100n).toString().padStart(2, "0");
}
function money(value: bigint, locale: Locale): string {
  return new Intl.NumberFormat(locale === "ar" ? "ar-EG" : "en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value) / 100);
}
function dateLabel(value: string, locale: Locale): string {
  const date = new Date(value + "T12:00:00.000Z");
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-US", {
    weekday: "short", day: "2-digit", month: "short",
  }).format(date);
}

const mealPlans = [
  ["RO", "Room only", "إقامة فقط"],
  ["BB", "Bed & breakfast", "إفطار"],
  ["HB", "Half board", "نصف إقامة"],
  ["FB", "Full board", "إقامة كاملة"],
  ["AI", "All inclusive", "شامل"],
  ["UAI", "Ultra all inclusive", "شامل مميز"],
  ["OTHER", "Other", "أخرى"],
] as const;
const roomTypes = [
  ["Standard Single", "Standard Single", "مفردة قياسية"],
  ["Standard Double", "Standard Double", "مزدوجة قياسية"],
  ["Standard Twin", "Standard Twin", "توين قياسية"],
  ["Standard Triple", "Standard Triple", "ثلاثية قياسية"],
  ["Quadruple", "Quadruple", "رباعية"],
  ["Superior", "Superior", "سوبيريور"],
  ["Deluxe", "Deluxe", "ديلوكس"],
  ["Executive", "Executive", "تنفيذية"],
  ["Family Room", "Family Room", "غرفة عائلية"],
  ["Junior Suite", "Junior Suite", "جناح جونيور"],
  ["Suite", "Suite", "جناح"],
  ["Presidential Suite", "Presidential Suite", "جناح رئاسي"],
  ["Studio", "Studio", "استوديو"],
  ["Apartment", "Apartment", "شقة فندقية"],
  ["Villa", "Villa", "فيلا"],
  ["Connecting Rooms", "Connecting Rooms", "غرف متصلة"],
  ["Accessible Room", "Accessible Room", "غرفة مجهزة لذوي الإعاقة"],
  ["Other", "Other", "أخرى"],
] as const;
const nationalities = [
  ["Egyptian", "مصري", "Egyptian"],
  ["Saudi", "سعودي", "Saudi"],
  ["Emirati", "إماراتي", "Emirati"],
  ["Kuwaiti", "كويتي", "Kuwaiti"],
  ["Qatari", "قطري", "Qatari"],
  ["Bahraini", "بحريني", "Bahraini"],
  ["Omani", "عماني", "Omani"],
  ["Jordanian", "أردني", "Jordanian"],
  ["Palestinian", "فلسطيني", "Palestinian"],
  ["Syrian", "سوري", "Syrian"],
  ["Lebanese", "لبناني", "Lebanese"],
  ["Iraqi", "عراقي", "Iraqi"],
  ["Sudanese", "سوداني", "Sudanese"],
  ["Yemeni", "يمني", "Yemeni"],
  ["Turkish", "تركي", "Turkish"],
  ["British", "بريطاني", "British"],
  ["American", "أمريكي", "American"],
  ["Other", "أخرى", "Other"],
] as const;
const tags = [
  ["HAJJ", "حج", "Hajj"],
  ["UMRAH", "عمرة", "Umrah"],
  ["VIP", "VIP", "VIP"],
  ["FAMILY", "عائلة", "Family"],
  ["GROUP", "مجموعة", "Group"],
  ["HONEYMOON", "شهر عسل", "Honeymoon"],
  ["CORPORATE", "شركة", "Corporate"],
] as const;
const channels = [
  ["DIRECT", "مباشر", "Direct"],
  ["AGENT", "وكيل", "Agent"],
  ["SUB_AGENT", "وكيل فرعي", "Sub-agent"],
  ["CORPORATE", "شركات", "Corporate"],
  ["ONLINE", "أونلاين", "Online"],
  ["WALK_IN", "زيارة مباشرة", "Walk-in"],
  ["OTHER", "أخرى", "Other"],
] as const;

function roomTypeLabel(value: string, locale: Locale): string {
  const option = roomTypes.find(([key]) => key === value);
  return option ? (locale === "ar" ? option[2] : option[1]) : value;
}

export function HotelReservationForm({
  locale, canReadCosts, customers, suppliers, hotels, initialReservation, draft, companyName,
  onCancel, onSaved,
}: Props) {
  const ar = locale === "ar";
  const initialStart = normalizeDate(initialReservation?.startDate);
  const initialEnd = normalizeDate(initialReservation?.endDate);
  const [customerId, setCustomerId] = useState(initialReservation?.customer.id ?? draft?.customerId ?? "");
  const [hotelId, setHotelId] = useState(initialReservation?.hotelDetail?.hotelId ?? hotels.find((hotel) => hotel.name === initialReservation?.hotelDetail?.hotelName)?.id ?? "");
  const [supplierId, setSupplierId] = useState(initialReservation?.supplier?.id ?? "");
  const [startDate, setStartDate] = useState(initialStart || draft?.startDate || "");
  const [endDate, setEndDate] = useState(initialEnd || draft?.endDate || "");
  const [currency, setCurrency] = useState(initialReservation?.currency ?? draft?.currency ?? "EGP");
  const [detail, setDetail] = useState<HotelDetail>(() => {
    const saved = initialReservation?.hotelDetail;
    return {
      ...emptyDetail(companyName),
      clientNationality: saved?.clientNationality ?? initialReservation?.customer.nationality ?? "",
      guestName: saved?.guestName ?? "",
      guestNationality: saved?.guestNationality ?? "Egyptian",
      guestPhone: saved?.guestPhone ?? "",
      rateCode: saved?.rateCode ?? "",
      clientOptionDate: normalizeDate(saved?.clientOptionDate),
      hotelOptionDate: normalizeDate(saved?.hotelOptionDate),
      termsAndConditions: saved?.termsAndConditions ?? "",
      generalPolicy: saved?.generalPolicy ?? "",
      tags: saved?.tags ?? [],
      fileNo: saved?.fileNo ?? "",
      reservationRemarks: saved?.reservationRemarks ?? initialReservation?.notes ?? "",
      roomNumber: saved?.roomNumber ?? "",
      hotelConfirmationNumber: saved?.hotelConfirmationNumber ?? "",
      voucher: saved?.voucher ?? "",
      referenceNumber: saved?.referenceNumber ?? "",
      detailRemarks: saved?.detailRemarks ?? "",
      agreementNumber: saved?.agreementNumber ?? "",
      costCenter: saved?.costCenter ?? "",
      hotelRemarks: saved?.hotelRemarks ?? "",
      company: saved?.company ?? companyName,
      subClient: saved?.subClient ?? "",
      salesperson: saved?.salesperson ?? "",
      channel: saved?.channel ?? "",
      clientRemarks: saved?.clientRemarks ?? "",
      bank: saved?.bank ?? "",
      paymentMethod: saved?.paymentMethod ?? "CASH",
      isManualRate: saved?.isManualRate ?? false,
      pricesIncludeVat: saved?.pricesIncludeVat ?? false,
    };
  });
  const [rooms, setRooms] = useState<RoomLine[]>(() => {
    const dates = nightsBetween(initialStart, initialEnd);
    const existing = initialReservation?.hotelDetail?.rooms ?? [];
    return existing.length ? existing.map((room, index) => buildRoom(room, dates, index)) : [buildRoom(undefined, dates, 0)];
  });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const dateList = useMemo(() => nightsBetween(startDate, endDate), [startDate, endDate]);
  const selectedCustomer = customers.find((customer) => customer.id === customerId);
  const totalNights = dateList.length;
  const totalRooms = rooms.reduce((sum, room) => sum + room.roomCount, 0);
  const totalAdults = rooms.reduce((sum, room) => sum + room.adults, 0);
  const totalChildren = rooms.reduce((sum, room) => sum + room.children, 0);
  const totalPax = totalAdults + totalChildren;
  const totalRoomNights = rooms.reduce((sum, room) => sum + room.roomCount * totalNights, 0);

  function changeDates(nextStart: string, nextEnd: string) {
    const dates = nightsBetween(nextStart, nextEnd);
    setStartDate(nextStart);
    setEndDate(nextEnd);
    setRooms((current) => current.map((room) => {
      const previous = new Map(room.rates.map((rate) => [rate.stayDate, rate]));
      return {
        ...room,
        rates: dates.map((date) => previous.get(date) ?? emptyRate(date)),
      };
    }));
  }
  function updateDetail<K extends keyof HotelDetail>(key: K, value: HotelDetail[K]) {
    setDetail((current) => ({ ...current, [key]: value }));
  }
  function updateRoom(index: number, patch: Partial<RoomLine>) {
    setRooms((current) => current.map((room, roomIndex) => roomIndex === index ? { ...room, ...patch } : room));
  }
  function updateRate(roomIndex: number, rateIndex: number, patch: Partial<NightRate>) {
    setRooms((current) => current.map((room, index) => index !== roomIndex ? room : {
      ...room,
      rates: room.rates.map((rate, ratePosition) => ratePosition === rateIndex ? { ...rate, ...patch } : rate),
    }));
  }
  function addRoom() {
    setRooms((current) => [...current, buildRoom(undefined, dateList, current.length)]);
  }
  function removeRoom(index: number) {
    setRooms((current) => current.filter((_, roomIndex) => roomIndex !== index));
  }

  function calcRate(room: RoomLine, rate: NightRate) {
    const pax = BigInt(room.adults + room.children);
    const roomQuantity = BigInt(room.roomCount);
    const saleRoom = amountToCents(rate.saleRoomRate) * roomQuantity;
    const saleMeal = amountToCents(rate.saleMealRatePerPax) * pax;
    const salePrice = saleRoom + saleMeal;
    const saleTotal = salePrice + (detail.pricesIncludeVat ? 0n : amountToCents(rate.saleVat));
    const costRoom = amountToCents(rate.costRoomRate) * roomQuantity;
    const costMeal = amountToCents(rate.costMealRatePerPax) * pax;
    const costPrice = costRoom + costMeal;
    const costTotal = costPrice + (detail.pricesIncludeVat ? 0n : amountToCents(rate.costVat));
    return { saleMeal, salePrice, saleTotal, costMeal, costPrice, costTotal };
  }
  const totals = rooms.reduce((acc, room) => {
    room.rates.forEach((rate) => {
      const line = calcRate(room, rate);
      acc.sale += line.saleTotal;
      acc.cost += line.costTotal;
    });
    return acc;
  }, { sale: 0n, cost: 0n });

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    try {
      if (!customerId) throw new Error("CUSTOMER_REQUIRED");
      if (!hotelId) throw new Error("HOTEL_REQUIRED");
      if (!supplierId) throw new Error("HOTEL_SUPPLIER_REQUIRED");
      if (!startDate || !endDate || !totalNights) throw new Error("DATES_REQUIRED");
      if (!detail.guestName.trim()) throw new Error("GUEST_REQUIRED");
      if (!rooms.length || rooms.some((room) => !room.roomType.trim())) throw new Error("ROOM_REQUIRED");
      const payload = {
        customerId,
        supplierId,
        serviceType: "HOTEL",
        startDate,
        endDate,
        currency,
        saleAmount: centsToAmount(totals.sale),
        ...(canReadCosts ? { costAmount: centsToAmount(totals.cost) } : {}),
        notes: detail.reservationRemarks,
        hotelDetails: {
          ...detail,
          hotelId,
          clientOptionDate: detail.clientOptionDate,
          hotelOptionDate: detail.hotelOptionDate,
          rooms: rooms.map((room) => ({
            ...(room.id ? { id: room.id } : {}),
            roomCount: room.roomCount,
            roomType: room.roomType.trim(),
            mealPlan: room.mealPlan,
            adults: room.adults,
            children: room.children,
            rates: room.rates.map((rate) => ({
              ...rate,
              ...(canReadCosts ? {} : { costRoomRate: "0.00", costMealRatePerPax: "0.00", costVat: "0.00" }),
            })),
          })),
        },
      };
      const response = await fetch(
        initialReservation ? `/api/reservations/${encodeURIComponent(initialReservation.id)}` : "/api/reservations",
        {
          method: initialReservation ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const responseText = await response.text();
      let result: {
        error?: string;
        issues?: Array<{ path?: string; message?: string }>;
        debug?: { name?: string; code?: string; message?: string };
      } = {};
      try {
        result = responseText ? JSON.parse(responseText) as typeof result : {};
      } catch {
        result = {};
      }
      if (!response.ok) {
        const code = result.error || `HTTP_${response.status}`;
        const validationText = (result.issues ?? [])
          .map((issue) => [issue.path, issue.message].filter(Boolean).join(": "))
          .filter(Boolean)
          .join("؛ ");
        const databaseText = result.debug
          ? [result.debug.name, result.debug.code, result.debug.message].filter(Boolean).join(" — ")
          : "";
        const details = [validationText, databaseText].filter(Boolean).join(" | ");
        throw new Error(details ? `${code}::${details}` : code);
      }
      onSaved(ar ? (initialReservation ? "تم تحديث الحجز الفندقي بنجاح." : "تم إنشاء الحجز الفندقي بنجاح.") : (initialReservation ? "Hotel reservation updated." : "Hotel reservation created."));
    } catch (reason) {
      const rawMessage = reason instanceof Error ? reason.message : "SAVE_FAILED";
      const separator = rawMessage.indexOf("::");
      const code = separator >= 0 ? rawMessage.slice(0, separator) : rawMessage;
      const issueText = separator >= 0 ? rawMessage.slice(separator + 2) : "";
      const messages: Record<string, string> = ar ? {
        CUSTOMER_REQUIRED: "اختر العميل أولًا.",
        HOTEL_REQUIRED: "اختر الفندق من قائمة الفنادق في الإعدادات.",
        HOTEL_SUPPLIER_REQUIRED: "اختر شركة المورد التي تشتري منها الحجز.",
        DATES_REQUIRED: "أدخل تاريخ الوصول والمغادرة، ويجب أن يكون المغادرة بعد الوصول.",
        GUEST_REQUIRED: "أدخل اسم النزيل الرئيسي.",
        ROOM_REQUIRED: "أضف غرفة واحدة على الأقل وأدخل نوع الغرفة.",
        INVALID_HOTEL_DATE_RANGE: "تاريخ المغادرة يجب أن يكون بعد تاريخ الوصول.",
        HOTEL_NIGHT_RATES_REQUIRED: "أدخل أسعار كل ليلة من ليالي الإقامة.",
        HOTEL_NIGHT_RATE_DATE_MISMATCH: "تواريخ الأسعار الليلية لا تطابق تواريخ الإقامة.",
        HOTEL_TOTAL_OUT_OF_RANGE: "إجمالي الحجز أكبر من الحد المسموح.",
        HOTEL_STAY_LENGTH_INVALID: "مدة الإقامة يجب ألا تتجاوز 365 ليلة.",
        VALIDATION_ERROR: "بعض البيانات المدخلة غير مطابقة للمطلوب.",
        UNAUTHENTICATED: "انتهت جلسة الدخول. حدّث الصفحة وسجّل الدخول مرة أخرى.",
        TENANT_SETUP_REQUIRED: "حسابك غير مرتبط بمساحة عمل. راجع إعدادات الشركة.",
        FORBIDDEN: "ليس لديك صلاحية إنشاء أو تعديل الحجوزات.",
        CONFLICT: "تم تعديل الحجز من مكان آخر. حدّث الصفحة وحاول مرة أخرى.",
        NOT_FOUND: "الحجز المطلوب غير موجود أو تم أرشفته.",
        CUSTOMER_NOT_FOUND: "شركة العميل المحددة غير موجودة أو غير نشطة.",
        CORPORATE_CLIENT_REQUIRED: "خدمة الفندق تتطلب اختيار عميل من نوع شركة (B2B).",
        SUPPLIER_NOT_FOUND: "شركة المورد المحددة غير موجودة أو غير نشطة.",
        HOTEL_NOT_FOUND: "الفندق المحدد غير موجود أو تم أرشفته من الإعدادات.",
        HOTEL_DETAILS_REQUIRED: "بيانات الفندق وتواريخ الإقامة مطلوبة.",
        HOTEL_DATES_REQUIRED: "أدخل تاريخ الوصول والمغادرة.",
        HOTEL_DETAILS_ONLY_FOR_HOTEL: "تفاصيل الفندق لا تتطابق مع نوع الخدمة.",
        INVALID_DATE_RANGE: "تاريخ المغادرة يجب أن يكون بعد تاريخ الوصول.",
        INVALID_JSON: "تعذر قراءة بيانات الحجز. حدّث الصفحة وأعد المحاولة.",
        HTTP_500: "حدث خطأ داخلي أثناء الحفظ. تحقق من سجل الخادم.",
        RESERVATION_SAVE_FAILED: "حدث خطأ داخلي أثناء حفظ الحجز. تحقق من سجل الخادم.",
      } : {
        CUSTOMER_REQUIRED: "Select a client.",
        HOTEL_REQUIRED: "Select a hotel from the hotel directory in Settings.",
        HOTEL_SUPPLIER_REQUIRED: "Select the supplier company providing this booking.",
        DATES_REQUIRED: "Enter arrival and departure dates. Departure must be after arrival.",
        GUEST_REQUIRED: "Enter the lead guest name.",
        ROOM_REQUIRED: "Add at least one room and specify its type.",
        INVALID_HOTEL_DATE_RANGE: "Departure must be after arrival.",
        HOTEL_NIGHT_RATES_REQUIRED: "Enter rates for every night of the stay.",
        HOTEL_NIGHT_RATE_DATE_MISMATCH: "Nightly rate dates do not match the stay dates.",
        HOTEL_TOTAL_OUT_OF_RANGE: "The reservation total exceeds the supported amount.",
        HOTEL_STAY_LENGTH_INVALID: "The stay cannot exceed 365 nights.",
        VALIDATION_ERROR: "Some entered details do not match the required format.",
        UNAUTHENTICATED: "Your session has expired. Refresh the page and sign in again.",
        TENANT_SETUP_REQUIRED: "Your account is not connected to a workspace.",
        FORBIDDEN: "You do not have permission to create or edit reservations.",
        CONFLICT: "This reservation changed elsewhere. Refresh and try again.",
        NOT_FOUND: "The requested reservation was not found or has been archived.",
        CUSTOMER_NOT_FOUND: "The selected client company was not found or is inactive.",
        CORPORATE_CLIENT_REQUIRED: "Hotel bookings require a B2B corporate client.",
        SUPPLIER_NOT_FOUND: "The selected supplier company was not found or is inactive.",
        HOTEL_NOT_FOUND: "The selected hotel was not found or has been archived in Settings.",
        HOTEL_DETAILS_REQUIRED: "Hotel details and stay dates are required.",
        HOTEL_DATES_REQUIRED: "Enter arrival and departure dates.",
        HOTEL_DETAILS_ONLY_FOR_HOTEL: "Hotel details do not match the selected service type.",
        INVALID_DATE_RANGE: "Departure must be after arrival.",
        INVALID_JSON: "The reservation data could not be read. Refresh and try again.",
        HTTP_500: "An internal error occurred while saving. Check the server log.",
        RESERVATION_SAVE_FAILED: "An internal error occurred while saving. Check the server log.",
      };
      const fallback = ar ? "تعذر حفظ الحجز." : "Could not save the reservation.";
      setError([messages[code] ?? `${fallback} ( ${code} )`, issueText].filter(Boolean).join(" — "));
    } finally {
      setPending(false);
    }
  }

  const field = (label: string, value: string, onChange: (value: string) => void, options: {
    type?: string; placeholder?: string; readOnly?: boolean; disabled?: boolean; required?: boolean; min?: string; max?: string; step?: string;
  } = {}) => (
    <label className="hotel-field">
      <span className="hotel-label">{label}{options.required ? " *" : ""}</span>
      <input
        className="hotel-input"
        type={options.type ?? "text"}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={options.placeholder ?? "—"}
        readOnly={options.readOnly}
        disabled={options.disabled}
        required={options.required}
        min={options.min}
        max={options.max}
        step={options.step}
      />
    </label>
  );

  const select = (label: string, value: string, onChange: (value: string) => void, options: ReadonlyArray<readonly [string, string]>, required = false, disabled = false) => (
    <label className="hotel-field">
      <span className="hotel-label">{label}{required ? " *" : ""}</span>
      <select className="hotel-select" value={value} required={required} disabled={disabled} onChange={(event) => onChange(event.target.value)}>
        <option value="">{ar ? "اختر..." : "Select..."}</option>
        {options.map(([optionValue, optionLabel]) => <option key={optionValue} value={optionValue}>{optionLabel}</option>)}
      </select>
    </label>
  );

  const textareaField = (label: string, value: string, onChange: (value: string) => void) => (
    <label className="hotel-field">
      <span className="hotel-label">{label}</span>
      <textarea className="hotel-textarea" value={value} onChange={(event) => onChange(event.target.value)} maxLength={4000} />
    </label>
  );


  const section = (icon: ReactNode, title: string, subtitle?: string, content?: ReactNode) => (
    <section className="hotel-section">
      <div className="hotel-section-heading">
        <div className="hotel-section-icon">{icon}</div>
        <div><h3>{title}</h3>{subtitle && <p>{subtitle}</p>}</div>
      </div>
      <div className="hotel-section-content">{content}</div>
    </section>
  );

  return (
    <section className="panel hotel-booking-panel">
      <div className="panel-header hotel-booking-heading">
        <div>
          <div className="ops-section-kicker">{ar ? "HOTEL RESERVATION" : "HOTEL RESERVATION"}</div>
          <h2 className="panel-title">{ar ? (initialReservation ? "تعديل حجز فندقي" : "إنشاء حجز فندقي جديد") : (initialReservation ? "Edit hotel reservation" : "Create hotel reservation")}</h2>
          <div className="panel-subtitle">{ar ? "ملف إقامة متكامل بالتفاصيل والغرف والأسعار اليومية" : "A complete stay file with guest, room and nightly pricing details"}</div>
        </div>
        <div className="hotel-booking-id"><span>{ar ? "رقم الحجز" : "RESERVATION ID"}</span><strong dir="ltr">{initialReservation?.reference ?? "AUTO-GENERATED"}</strong></div>
        <button className="icon-button" type="button" onClick={onCancel} aria-label={ar ? "إغلاق" : "Close"}><X size={17} /></button>
      </div>

      <form className="hotel-booking-form" onSubmit={submit}>
        {error && <div className="alert" role="alert">{error}</div>}
        {customers.length === 0 && <div className="alert">{ar ? "أضف شركة عميلة من قائمة العملاء (نوع العميل: شركة) قبل إنشاء الحجز." : "Add a Corporate client company before creating a reservation."}</div>}
        {hotels.length === 0 && <div className="alert">{ar ? "لا توجد فنادق مسجلة. افتح الإعدادات ثم قائمة الفنادق وأضف الفندق أولًا." : "No hotels are registered. Add a hotel from Settings → Hotels first."}</div>}{suppliers.every((supplier) => supplier.category !== "HOTEL") && <div className="alert">{ar ? "لا توجد شركات موردين لخدمة الفنادق. أضف شركة مورد بتصنيف فندق من الإعدادات." : "No hotel suppliers found. Add a supplier company with the Hotel category in Settings."}</div>}

        {section(<CalendarDays size={17} />, ar ? "تفاصيل الحجز" : "Reservation details", ar ? "شركة العميل والمورد وتواريخ الإقامة وبيانات النزيل" : "Client company, supplier, stay dates and guest details", <>
          <div className="hotel-grid hotel-grid-4">
            <label className="hotel-field"><span className="hotel-label">{ar ? "نوع الخدمة" : "Service type"}</span><input className="hotel-input hotel-readonly" value={ar ? "فندق" : "Hotel"} readOnly /></label>
            {field(ar ? "تاريخ الوصول" : "Arrival date", startDate, (value) => changeDates(value, endDate), { type: "date", required: true })}
            <label className="hotel-field">
              <span className="hotel-label">{ar ? "عدد الليالي" : "Nights"}</span>
              <input className="hotel-input hotel-readonly" readOnly value={totalNights ? String(totalNights) : "—"} />
            </label>
            {field(ar ? "تاريخ المغادرة" : "Departure date", endDate, (value) => changeDates(startDate, value), { type: "date", min: startDate || undefined, required: true })}
            <label className="hotel-field">
              <span className="hotel-label">{ar ? "شركة العميل (B2B)" : "Client company (B2B)"} *</span>
              <select className="hotel-select" value={customerId} onChange={(event) => {
                const nextCustomerId = event.target.value;
                setCustomerId(nextCustomerId);
                const nextCustomer = customers.find((customer) => customer.id === nextCustomerId);
                setDetail((current) => ({ ...current, clientNationality: nextCustomer?.nationality ?? "" }));
              }} required>
                <option value="">{ar ? "اختر شركة العميل" : "Select client company"}</option>
                {customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.companyName || customer.name}</option>)}
              </select>
            </label>
            <label className="hotel-field">
              <span className="hotel-label">{ar ? "جنسية العميل" : "Client nationality"}</span>
              <select className="hotel-select" value={detail.clientNationality || selectedCustomer?.nationality || ""} onChange={(event) => updateDetail("clientNationality", event.target.value)}><option value="">{ar ? "اختر الجنسية" : "Select nationality"}</option>{nationalities.map(([value, arabic, english]) => <option key={value} value={value}>{ar ? arabic : english}</option>)}</select>
            </label>
            <label className="hotel-field">
              <span className="hotel-label">{ar ? "الفندق (مكان الإقامة)" : "Hotel property"} *</span>
              <select className="hotel-select" value={hotelId} onChange={(event) => setHotelId(event.target.value)} required>
                <option value="">{ar ? "اختر الفندق" : "Select hotel"}</option>
                {hotels.map((hotel) => <option key={hotel.id} value={hotel.id}>{hotel.name}{hotel.city ? ` — ${hotel.city}` : ""}</option>)}
              </select>
            </label>
            <label className="hotel-field">
              <span className="hotel-label">{ar ? "شركة المورد (تشتري منها)" : "Supplier company"} *</span>
              <select className="hotel-select" value={supplierId} onChange={(event) => setSupplierId(event.target.value)} required>
                <option value="">{ar ? "اختر شركة المورد" : "Select supplier company"}</option>
                {suppliers.filter((supplier) => supplier.category === "HOTEL").map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
              </select>
            </label>
            {field(ar ? "اسم النزيل الرئيسي" : "Guest name", detail.guestName, (value) => updateDetail("guestName", value), { required: true, placeholder: ar ? "اسم النزيل كما في جواز السفر" : "Guest name as in passport" })}
            {select(ar ? "جنسية النزيل" : "Guest nationality", detail.guestNationality, (value) => updateDetail("guestNationality", value), nationalities.map(([value, arabic, english]) => [value, ar ? arabic : english] as const))}
            {field(ar ? "رقم الهاتف" : "Phone", detail.guestPhone, (value) => updateDetail("guestPhone", value), { type: "tel" })}
            {field(ar ? "كود السعر" : "Rate code", detail.rateCode, (value) => updateDetail("rateCode", value))}
            {field(ar ? "آخر موعد لسداد العميل (اختياري)" : "Client payment option date (optional)", detail.clientOptionDate, (value) => updateDetail("clientOptionDate", value), { type: "date" })}
            {field(ar ? "آخر موعد لتأكيد الفندق (اختياري)" : "Hotel confirmation option date (optional)", detail.hotelOptionDate, (value) => updateDetail("hotelOptionDate", value), { type: "date" })}
          </div>
          <div className="hotel-grid hotel-grid-2 hotel-spaced">
            {textareaField(ar ? "الشروط والأحكام" : "Terms & conditions", detail.termsAndConditions, (value) => updateDetail("termsAndConditions", value))}
            {textareaField(ar ? "السياسة العامة" : "General policy", detail.generalPolicy, (value) => updateDetail("generalPolicy", value))}
          </div>
          <div className="hotel-tag-row">
            <span className="hotel-label">{ar ? "التصنيفات" : "Tags"}</span>
            <div className="hotel-tags">
              {tags.map(([value, arabic, english]) => (
                <label className={`hotel-tag ${detail.tags.includes(value) ? "selected" : ""}`} key={value}>
                  <input type="checkbox" checked={detail.tags.includes(value)} onChange={(event) => updateDetail("tags", event.target.checked ? [...detail.tags, value] : detail.tags.filter((tag) => tag !== value))} />
                  <span>{ar ? arabic : english}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="hotel-grid hotel-grid-2 hotel-spaced">
            {field(ar ? "رقم الملف" : "File No.", detail.fileNo, (value) => updateDetail("fileNo", value))}
            {textareaField(ar ? "ملاحظات الحجز" : "Reservation remarks", detail.reservationRemarks, (value) => updateDetail("reservationRemarks", value))}
          </div>
        </>)}

        {section(<BedDouble size={17} />, ar ? "تفاصيل الغرف والتسعير" : "Room details & pricing", ar ? "أضف أكثر من نوع غرفة، وحدد سعر البيع والتكلفة لكل ليلة" : "Add multiple room types and enter sale and cost rates for each night", <>
          <div className="hotel-pricing-options">
            <label className="hotel-check"><input type="checkbox" checked={detail.isManualRate} onChange={(event) => updateDetail("isManualRate", event.target.checked)} /><span>{ar ? "السعر يدوي" : "Is manual rate"}</span></label>
            <label className="hotel-check"><input type="radio" name="hotel-prices-vat" checked={detail.pricesIncludeVat} onChange={() => updateDetail("pricesIncludeVat", true)} /><span>{ar ? "السعر يشمل ضريبة القيمة المضافة" : "Price includes VAT"}</span></label>
            <label className="hotel-check"><input type="radio" name="hotel-prices-vat" checked={!detail.pricesIncludeVat} onChange={() => updateDetail("pricesIncludeVat", false)} /><span>{ar ? "الأسعار لا تشمل ضريبة القيمة المضافة" : "Prices do not include VAT"}</span></label>
            <label className="hotel-field hotel-currency-field">
              <span className="hotel-label">{ar ? "العملة" : "Currency"}</span>
              <select className="hotel-select" value={currency} onChange={(event) => setCurrency(event.target.value)}>
                <option value="EGP">EGP — {ar ? "جنيه مصري" : "Egyptian pound"}</option>
                <option value="SAR">SAR — {ar ? "ريال سعودي" : "Saudi riyal"}</option>
                <option value="USD">USD — {ar ? "دولار أمريكي" : "US dollar"}</option>
              </select>
            </label>
            <button className="btn btn-secondary" type="button" onClick={addRoom}><Plus size={15} />{ar ? "إضافة غرفة / نوع غرفة" : "Add room / room type"}</button>
          </div>

          {!dateList.length && <div className="hotel-inline-note">{ar ? "حدد تاريخ الوصول والمغادرة أولًا لعرض جدول كل ليلة." : "Set arrival and departure dates to generate the nightly rate table."}</div>}

          {rooms.map((room, roomIndex) => {
            const roomTotals = room.rates.reduce((acc, rate) => {
              const line = calcRate(room, rate);
              acc.sale += line.saleTotal;
              acc.cost += line.costTotal;
              return acc;
            }, { sale: 0n, cost: 0n });
            return (
              <article className="hotel-room-card" key={room.key}>
                <div className="hotel-room-heading">
                  <div><strong>{ar ? `مجموعة الغرف ${roomIndex + 1}` : `Room group ${roomIndex + 1}`}</strong><span>{ar ? `${room.roomCount} غرفة · ${room.roomCount * totalNights} ليلة غرفة` : `${room.roomCount} rooms · ${room.roomCount * totalNights} room nights`}</span></div>
                  <button className="hotel-icon-action danger" type="button" disabled={rooms.length === 1} onClick={() => removeRoom(roomIndex)} title={ar ? "حذف مجموعة الغرف" : "Remove room group"}><Trash2 size={15} /></button>
                </div>
                <div className="hotel-grid hotel-grid-5 hotel-room-fields">
                  {field(ar ? "عدد الغرف" : "No. of rooms", String(room.roomCount), (value) => updateRoom(roomIndex, { roomCount: Math.max(1, Math.min(100, Number(value) || 1)) }), { type: "number", min: "1", max: "100", required: true })}
                  <label className="hotel-field">
                    <span className="hotel-label">{ar ? "نوع الغرفة" : "Room type"} *</span>
                    <select className="hotel-select" value={room.roomType} onChange={(event) => updateRoom(roomIndex, { roomType: event.target.value })} required>
                      <option value="" disabled>{ar ? "اختر نوع الغرفة" : "Select room type"}</option>
                      {room.roomType && !roomTypes.some(([value]) => value === room.roomType) && <option value={room.roomType}>{room.roomType}</option>}
                      {roomTypes.map(([value, english, arabic]) => <option key={value} value={value}>{ar ? arabic : english}</option>)}
                    </select>
                  </label>
                  <label className="hotel-field"><span className="hotel-label">{ar ? "خطة الوجبات" : "Meal plan"}</span><select className="hotel-select" value={room.mealPlan} onChange={(event) => updateRoom(roomIndex, { mealPlan: event.target.value })}>{mealPlans.map(([value, english, arabic]) => <option key={value} value={value}>{ar ? arabic : english}</option>)}</select></label>
                  {field(ar ? "عدد البالغين" : "No. of adults", String(room.adults), (value) => updateRoom(roomIndex, { adults: Math.max(0, Math.min(200, Number(value) || 0)) }), { type: "number", min: "0", max: "200" })}
                  {field(ar ? "عدد الأطفال" : "No. of children", String(room.children), (value) => updateRoom(roomIndex, { children: Math.max(0, Math.min(200, Number(value) || 0)) }), { type: "number", min: "0", max: "200" })}
                </div>
                <div className="hotel-night-table-wrap">
                  <table className="hotel-night-table">
                    <thead>
                      <tr><th rowSpan={2}>{ar ? "التاريخ" : "Date"}</th><th colSpan={6}>{ar ? "سعر البيع" : "Sale"}</th>{canReadCosts && <th colSpan={6}>{ar ? "التكلفة" : "Cost"}</th>}</tr>
                      <tr>
                        <th>{ar ? "الغرفة" : "Room"}</th><th>{ar ? "وجبة / فرد" : "Meal / PAX"}</th><th>{ar ? "سعر الوجبة" : "Meal price"}</th><th>{ar ? "السعر" : "Price"}</th><th>VAT</th><th>{ar ? "الإجمالي" : "Total"}</th>
                        {canReadCosts && <><th>{ar ? "الغرفة" : "Room"}</th><th>{ar ? "وجبة / فرد" : "Meal / PAX"}</th><th>{ar ? "سعر الوجبة" : "Meal price"}</th><th>{ar ? "السعر" : "Price"}</th><th>VAT</th><th>{ar ? "الإجمالي" : "Total"}</th></>}
                      </tr>
                    </thead>
                    <tbody>
                      {room.rates.map((rate, rateIndex) => {
                        const calc = calcRate(room, rate);
                        return (
                          <tr key={rate.stayDate}>
                            <td><strong>{dateLabel(rate.stayDate, locale)}</strong><small dir="ltr">{rate.stayDate}</small></td>
                            <td><input aria-label={`Sale room rate ${rate.stayDate}`} type="number" min="0" step="0.01" value={rate.saleRoomRate} onChange={(event) => updateRate(roomIndex, rateIndex, { saleRoomRate: event.target.value || "0.00" })} /></td>
                            <td><input aria-label={`Sale meal per PAX ${rate.stayDate}`} type="number" min="0" step="0.01" value={rate.saleMealRatePerPax} onChange={(event) => updateRate(roomIndex, rateIndex, { saleMealRatePerPax: event.target.value || "0.00" })} /></td>
                            <td className="hotel-calculated">{money(calc.saleMeal, locale)}</td>
                            <td className="hotel-calculated">{money(calc.salePrice, locale)}</td>
                            <td><input aria-label={`Sale VAT ${rate.stayDate}`} type="number" min="0" step="0.01" value={rate.saleVat} onChange={(event) => updateRate(roomIndex, rateIndex, { saleVat: event.target.value || "0.00" })} /></td>
                            <td className="hotel-total-cell">{money(calc.saleTotal, locale)}</td>
                            {canReadCosts && <>
                              <td><input aria-label={`Cost room rate ${rate.stayDate}`} type="number" min="0" step="0.01" value={rate.costRoomRate} onChange={(event) => updateRate(roomIndex, rateIndex, { costRoomRate: event.target.value || "0.00" })} /></td>
                              <td><input aria-label={`Cost meal per PAX ${rate.stayDate}`} type="number" min="0" step="0.01" value={rate.costMealRatePerPax} onChange={(event) => updateRate(roomIndex, rateIndex, { costMealRatePerPax: event.target.value || "0.00" })} /></td>
                              <td className="hotel-calculated">{money(calc.costMeal, locale)}</td>
                              <td className="hotel-calculated">{money(calc.costPrice, locale)}</td>
                              <td><input aria-label={`Cost VAT ${rate.stayDate}`} type="number" min="0" step="0.01" value={rate.costVat} onChange={(event) => updateRate(roomIndex, rateIndex, { costVat: event.target.value || "0.00" })} /></td>
                              <td className="hotel-total-cell cost">{money(calc.costTotal, locale)}</td>
                            </>}
                          </tr>
                        );
                      })}
                      {!room.rates.length && <tr><td colSpan={canReadCosts ? 13 : 7} className="hotel-empty-row">{ar ? "حدد فترة الإقامة لعرض الليالي." : "Choose a stay period to show the nights."}</td></tr>}
                    </tbody>
                    {room.rates.length > 0 && <tfoot><tr>
                      <td>{ar ? "إجمالي الليالي" : "All nights total"}</td>
                      <td colSpan={5}></td>
                      <td className="hotel-total-cell">{money(roomTotals.sale, locale)} {currency}</td>
                      {canReadCosts && <><td colSpan={5}></td><td className="hotel-total-cell cost">{money(roomTotals.cost, locale)} {currency}</td></>}
                    </tr></tfoot>}
                  </table>
                </div>
              </article>
            );
          })}

          <div className="hotel-room-summary-wrap">
            <table className="hotel-room-summary">
              <thead><tr>
                <th>{ar ? "عدد الغرف" : "No. of rooms"}</th>
                <th>{ar ? "إجمالي ليالي الغرف" : "Total RN"}</th>
                <th>{ar ? "نوع الغرفة" : "Room type"}</th>
                <th>{ar ? "خطة الوجبات" : "Meal plan"}</th>
                <th>{ar ? "إجمالي البيع" : "Total sale"}</th>
                {canReadCosts && <th>{ar ? "إجمالي التكلفة" : "Total cost"}</th>}
                <th>{ar ? "الإجراءات" : "Actions"}</th>
              </tr></thead>
              <tbody>{rooms.map((room, index) => {
                const roomTotal = room.rates.reduce((sum, rate) => sum + calcRate(room, rate).saleTotal, 0n);
                const costTotal = room.rates.reduce((sum, rate) => sum + calcRate(room, rate).costTotal, 0n);
                return <tr key={room.key}>
                  <td>{room.roomCount}</td><td>{room.roomCount * totalNights}</td><td>{room.roomType ? roomTypeLabel(room.roomType, locale) : "—"}</td><td>{mealPlans.find(([value]) => value === room.mealPlan)?.[locale === "ar" ? 2 : 1] ?? room.mealPlan}</td>
                  <td>{money(roomTotal, locale)} {currency}</td>{canReadCosts && <td>{money(costTotal, locale)} {currency}</td>}
                  <td><button className="hotel-icon-action danger" type="button" disabled={rooms.length === 1} onClick={() => removeRoom(index)}><Trash2 size={14} />{ar ? "حذف" : "Remove"}</button></td>
                </tr>;
              })}</tbody>
              <tfoot><tr>
                <td>{totalRooms}</td><td>{totalRoomNights}</td><td colSpan={2}>{ar ? "الإجمالي" : "Total"}</td>
                <td>{money(totals.sale, locale)} {currency}</td>{canReadCosts && <td>{money(totals.cost, locale)} {currency}</td>}<td>—</td>
              </tr></tfoot>
            </table>
          </div>
          <div className="hotel-pax-summary">
            <div><span>{ar ? "عدد البالغين" : "No. of adults"}</span><strong>{totalAdults}</strong></div>
            <div><span>{ar ? "عدد الأطفال" : "No. of children"}</span><strong>{totalChildren}</strong></div>
            <div><span>PAX</span><strong>{totalPax}</strong></div>
            <div><span>{ar ? "إجمالي الليالي" : "Nights"}</span><strong>{totalNights}</strong></div>
          </div>
        </>)}

        {section(<FileText size={17} />, ar ? "بيانات الفندق والتأكيد" : "Hotel confirmation details", undefined, <>
          <div className="hotel-grid hotel-grid-4">
            {field(ar ? "رقم الغرفة" : "Room No.", detail.roomNumber, (value) => updateDetail("roomNumber", value))}
            {field(ar ? "رقم تأكيد الفندق" : "Hotel Conf. No.", detail.hotelConfirmationNumber, (value) => updateDetail("hotelConfirmationNumber", value))}
            {field(ar ? "القسيمة" : "Voucher", detail.voucher, (value) => updateDetail("voucher", value))}
            {field(ar ? "رقم المرجع" : "Reference No.", detail.referenceNumber, (value) => updateDetail("referenceNumber", value))}
            {field(ar ? "رقم الاتفاقية" : "Agreement No.", detail.agreementNumber, (value) => updateDetail("agreementNumber", value))}
            {field(ar ? "مركز التكلفة" : "Cost center", detail.costCenter, (value) => updateDetail("costCenter", value))}
            {textareaField(ar ? "ملاحظات الفندق" : "Hotel remarks", detail.hotelRemarks, (value) => updateDetail("hotelRemarks", value))}
            {textareaField(ar ? "ملاحظات التفاصيل" : "Detail remarks", detail.detailRemarks, (value) => updateDetail("detailRemarks", value))}
          </div>
        </>)}

        {section(<Building2 size={17} />, ar ? "بيانات المبيعات والعميل" : "Company & sales details", undefined, <>
          <div className="hotel-grid hotel-grid-4">
            {field(ar ? "الشركة" : "Company", detail.company, (value) => updateDetail("company", value), { readOnly: true })}
            {field(ar ? "العميل الفرعي" : "Sub client", detail.subClient, (value) => updateDetail("subClient", value))}
            {field(ar ? "مسؤول المبيعات" : "Salesperson", detail.salesperson, (value) => updateDetail("salesperson", value))}
            {select(ar ? "قناة البيع" : "Channel", detail.channel, (value) => updateDetail("channel", value), channels.map(([value, arabic, english]) => [value, ar ? arabic : english] as const))}
          </div>
          <div className="hotel-spaced">{textareaField(ar ? "ملاحظات العميل" : "Client remarks", detail.clientRemarks, (value) => updateDetail("clientRemarks", value))}</div>
        </>)}

        {section(<Wallet size={17} />, ar ? "بيانات الدفع" : "Payment details", undefined, <>
          <div className="hotel-grid hotel-grid-3">
            {field(ar ? "البنك" : "Bank", detail.bank, (value) => updateDetail("bank", value))}
            <label className="hotel-field"><span className="hotel-label">{ar ? "طريقة الدفع" : "Payment method"}</span><select className="hotel-select" value={detail.paymentMethod} onChange={(event) => updateDetail("paymentMethod", event.target.value)}>
              <option value="CASH">{ar ? "نقدي" : "Cash"}</option><option value="BANK_TRANSFER">{ar ? "تحويل بنكي" : "Bank transfer"}</option><option value="CARD">{ar ? "بطاقة" : "Card"}</option><option value="ELECTRONIC_WALLET">{ar ? "محفظة إلكترونية" : "Electronic wallet"}</option><option value="THNDR">Thndr</option><option value="OTHER">{ar ? "أخرى" : "Other"}</option>
            </select></label>
            <label className="hotel-field"><span className="hotel-label">{ar ? "العملة" : "Currency"}</span><select className="hotel-select" value={currency} onChange={(event) => setCurrency(event.target.value)}><option value="EGP">EGP</option><option value="SAR">SAR</option><option value="USD">USD</option></select></label>
          </div>
          <p className="hotel-footnote">{ar
            ? "طريقة الدفع والبنك هنا بيانات مرتبطة بالحجز فقط، ولا تُنشئ إيصال تحصيل أو قيدًا محاسبيًا. سجّل التحصيل الفعلي من الإدارة المالية."
            : "Bank and payment method here are booking details only; they do not create a receipt or accounting entry. Record actual collections in Finance."}</p>
          <div className="hotel-finance-total">
            <div><span>{ar ? "إجمالي سعر البيع" : "Total sale"}</span><strong>{money(totals.sale, locale)} {currency}</strong></div>
            {canReadCosts && <div><span>{ar ? "إجمالي تكلفة المورد" : "Total supplier cost"}</span><strong>{money(totals.cost, locale)} {currency}</strong></div>}
            {canReadCosts && <div><span>{ar ? "هامش تقديري" : "Estimated margin"}</span><strong>{money(totals.sale - totals.cost, locale)} {currency}</strong></div>}
          </div>
        </>)}

        {section(<FileText size={17} />, ar ? "المرفقات" : "Attachments", ar ? "المستندات المرتبطة بملف الحجز" : "Documents associated with this reservation", <>
          <div className="hotel-attachments">
            <div className="hotel-attachments-head"><span>{ar ? "الملف" : "File"}</span><span>{ar ? "اسم الملف" : "File name"}</span><span>{ar ? "الإجراءات" : "Actions"}</span></div>
            <div className="hotel-attachments-empty">{ar ? "لا توجد ملفات مرفقة بهذا الحجز." : "No files are attached to this reservation."}</div>
          </div>
          <p className="hotel-footnote">{ar ? "رفع الملفات سيُفعّل عند ربط مخزن ملفات آمن وصلاحيات الوصول؛ لم نضف زر رفع غير متصل بحفظ حقيقي." : "File upload will be enabled with secure storage and access controls; no inactive upload control is shown."}</p>
        </>)}

        <div className="hotel-form-footer">
          <div className="hotel-form-total"><span>{ar ? "الإجمالي" : "Reservation total"}</span><strong>{money(totals.sale, locale)} {currency}</strong></div>
          <div className="hotel-form-actions">
            <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={pending}><X size={15} />{ar ? "إلغاء" : "Cancel"}</button>
            <button type="submit" className="btn btn-primary" disabled={pending || customers.length === 0 || hotels.length === 0}><Save size={15} />{pending ? (ar ? "جارٍ الحفظ..." : "Saving...") : (ar ? "حفظ الحجز" : "Save reservation")}</button>
          </div>
        </div>
      </form>
    </section>
  );
}
