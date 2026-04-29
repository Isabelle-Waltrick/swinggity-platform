// The code in this file were created with help of AI (Copilot)

/**
 * Calendar Constants Guide
 * This file defines shared domain constants for calendar behavior.
 * Rules like option lists, limits, and defaults live here intentionally.
 * It helps explain "why this value is allowed" from one central place.
 */

export const EVENT_TYPES = ["Social", "Class", "Workshop", "Festival"];
export const MUSIC_FORMATS = ["Both", "DJ", "Live music"];
export const TICKET_TYPES = ["prepaid", "door"];
export const RESALE_OPTIONS = ["When tickets are sold-out", "Always"];
export const RESALE_TICKETS_MAX = 10;
export const RESALE_VISIBILITY_OPTIONS = ["anyone", "mutual", "circle"];
export const DEFAULT_RESALE_VISIBILITY = "anyone";
export const CONTACT_MESSAGE_MAX_WORDS = 200;
export const COHOST_INVITATION_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;
export const EVENT_DESCRIPTION_MAX_LENGTH = 2000;
export const GEOAPIFY_AUTOCOMPLETE_URL = "https://api.geoapify.com/v1/geocode/autocomplete";
export const GEOAPIFY_REVERSE_URL = "https://api.geoapify.com/v1/geocode/reverse";

export const EURO_COUNTRY_CODES = new Set([
    "ad", "at", "be", "cy", "de", "ee", "es", "fi", "fr", "gr", "hr", "ie", "it", "lt", "lu", "lv", "mc", "mt", "nl", "pt", "si", "sk", "sm", "va",
]);

export const COUNTRY_TO_CURRENCY = new Map([
    ["ae", "AED"], ["af", "AFN"], ["al", "ALL"], ["am", "AMD"], ["ao", "AOA"], ["ar", "ARS"], ["au", "AUD"], ["aw", "AWG"],
    ["az", "AZN"], ["ba", "BAM"], ["bb", "BBD"], ["bd", "BDT"], ["bg", "BGN"], ["bh", "BHD"], ["bi", "BIF"], ["bm", "BMD"],
    ["bn", "BND"], ["bo", "BOB"], ["br", "BRL"], ["bs", "BSD"], ["bt", "BTN"], ["bw", "BWP"], ["by", "BYN"], ["bz", "BZD"],
    ["ca", "CAD"], ["cd", "CDF"], ["ch", "CHF"], ["cl", "CLP"], ["cn", "CNY"], ["co", "COP"], ["cr", "CRC"], ["cu", "CUP"],
    ["cv", "CVE"], ["cz", "CZK"], ["dj", "DJF"], ["dk", "DKK"], ["do", "DOP"], ["dz", "DZD"], ["eg", "EGP"], ["er", "ERN"],
    ["et", "ETB"], ["fj", "FJD"], ["fk", "FKP"], ["gb", "GBP"], ["ge", "GEL"], ["gh", "GHS"], ["gi", "GIP"], ["gm", "GMD"],
    ["gn", "GNF"], ["gt", "GTQ"], ["gy", "GYD"], ["hk", "HKD"], ["hn", "HNL"], ["ht", "HTG"], ["hu", "HUF"], ["id", "IDR"],
    ["il", "ILS"], ["in", "INR"], ["iq", "IQD"], ["ir", "IRR"], ["is", "ISK"], ["jm", "JMD"], ["jo", "JOD"], ["jp", "JPY"],
    ["ke", "KES"], ["kg", "KGS"], ["kh", "KHR"], ["km", "KMF"], ["kp", "KPW"], ["kr", "KRW"], ["kw", "KWD"], ["ky", "KYD"],
    ["kz", "KZT"], ["la", "LAK"], ["lb", "LBP"], ["lk", "LKR"], ["lr", "LRD"], ["ly", "LYD"], ["ma", "MAD"], ["md", "MDL"],
    ["mg", "MGA"], ["mk", "MKD"], ["mm", "MMK"], ["mn", "MNT"], ["mo", "MOP"], ["mr", "MRU"], ["mu", "MUR"], ["mv", "MVR"],
    ["mw", "MWK"], ["mx", "MXN"], ["my", "MYR"], ["mz", "MZN"], ["na", "NAD"], ["ng", "NGN"], ["ni", "NIO"], ["no", "NOK"],
    ["np", "NPR"], ["nz", "NZD"], ["om", "OMR"], ["pa", "PAB"], ["pe", "PEN"], ["pg", "PGK"], ["ph", "PHP"], ["pk", "PKR"],
    ["pl", "PLN"], ["py", "PYG"], ["qa", "QAR"], ["ro", "RON"], ["rs", "RSD"], ["ru", "RUB"], ["rw", "RWF"], ["sa", "SAR"],
    ["sb", "SBD"], ["sc", "SCR"], ["sd", "SDG"], ["se", "SEK"], ["sg", "SGD"], ["sh", "SHP"], ["sl", "SLE"], ["so", "SOS"],
    ["sr", "SRD"], ["ss", "SSP"], ["st", "STN"], ["sz", "SZL"], ["th", "THB"], ["tj", "TJS"], ["tm", "TMT"], ["tn", "TND"],
    ["to", "TOP"], ["tr", "TRY"], ["tt", "TTD"], ["tw", "TWD"], ["tz", "TZS"], ["ua", "UAH"], ["ug", "UGX"], ["us", "USD"],
    ["uy", "UYU"], ["uz", "UZS"], ["ve", "VES"], ["vn", "VND"], ["vu", "VUV"], ["ws", "WST"], ["ye", "YER"], ["za", "ZAR"],
    ["zm", "ZMW"], ["zw", "USD"],
    ["ag", "XCD"], ["ai", "XCD"], ["dm", "XCD"], ["gd", "XCD"], ["kn", "XCD"], ["lc", "XCD"], ["ms", "XCD"], ["vc", "XCD"],
    ["bj", "XOF"], ["bf", "XOF"], ["ci", "XOF"], ["gw", "XOF"], ["ml", "XOF"], ["ne", "XOF"], ["sn", "XOF"], ["tg", "XOF"],
    ["cm", "XAF"], ["cf", "XAF"], ["cg", "XAF"], ["ga", "XAF"], ["gq", "XAF"], ["td", "XAF"],
    ["nc", "XPF"], ["pf", "XPF"], ["wf", "XPF"],
    ["ec", "USD"], ["sv", "USD"], ["fm", "USD"], ["mh", "USD"], ["pw", "USD"], ["pr", "USD"], ["vi", "USD"],
    ["gg", "GBP"], ["im", "GBP"], ["je", "GBP"],
]);
