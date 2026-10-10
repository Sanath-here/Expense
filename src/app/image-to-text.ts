type ImageToTextResponse = Promise<
  | { failure?: undefined; success: string }
  | { failure: string; success?: undefined }
>;

type ReceiptData = {
  date: string;
  category: "grocery" | "transportation" | "clothing" | "electronics" | "other";
  total: number;
};

type TextToObjectResponse = Promise<
  | { failure?: undefined; success: ReceiptData }
  | { failure: string; success?: undefined }
>;

export const imageToText = async (image: File): ImageToTextResponse => {
  try {
    const { createWorker } = await import("tesseract.js");
    const worker = await createWorker("eng");
    try {
      const result = await worker.recognize(image);
      const text = result.data.text.trim();
      return text
        ? { success: text }
        : { failure: "No readable text found. Try a clearer image." };
    } finally {
      await worker.terminate();
    }
  } catch (error) {
    console.error(error);
    return { failure: "Local OCR failed. Try a JPG or PNG image." };
  }
};

const parseDate = (text: string) => {
  const datePattern = /(\d{1,4})[./-](\d{1,2})[./-](\d{2,4})/;
  const labeledDate = text.match(
    /(?:receipt\s*date|transaction\s*date|purchase\s*date|date)\D{0,12}(\d{1,4}[./-]\d{1,2}[./-]\d{2,4})/i
  )?.[1];
  const match = (labeledDate ?? text.match(datePattern)?.[0])?.match(datePattern);
  if (!match) return null;

  const first = Number(match[1]);
  const second = Number(match[2]);
  const third = Number(match[3]);
  let year: number;
  let month: number;
  let day: number;

  if (match[1].length === 4) {
    year = first;
    month = second;
    day = third;
  } else {
    day = first > 12 ? first : second;
    month = first > 12 ? second : first;
    year = third;
  }

  if (year < 100) year += year < 50 ? 2000 : 1900;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
};

const parseAmount = (text: string) => {
  const amountPattern = /(?:[$€£]\s*)?(\d[\d,]*(?:\.\d{1,2})?)/g;
  const matches = [...text.matchAll(amountPattern)];
  const amount = matches.at(-1)?.[1];
  if (!amount) return null;
  const value = Number(amount.replace(/,/g, ""));
  return Number.isFinite(value) ? value : null;
};

const parseTotal = (text: string) => {
  const lines = text.split(/\r?\n/).map((line) => line.trim());
  const labels = [
    /\b(?:receipt\s+total|grand\s+total)\b/i,
    /\b(?:total\s+due|amount\s+due|balance\s+due)\b/i,
    /\btotal\b/i,
  ];

  for (const label of labels) {
    const index = lines.findIndex((line) => label.test(line));
    if (index === -1) continue;
    for (const line of lines.slice(index, index + 2)) {
      const amount = parseAmount(line);
      if (amount !== null) return amount;
    }
  }

  return null;
};

const parseCategory = (text: string): ReceiptData["category"] => {
  const lowerText = text.toLowerCase();
  if (/\b(grocery|groceries|supermarket|produce|food|fruit|vegetables?|meat|milk|bread)\b/.test(lowerText)) {
    return "grocery";
  }
  if (/\b(gas|fuel|uber|taxi|transit|parking|train|bus)\b/.test(lowerText)) {
    return "transportation";
  }
  if (/\b(clothing|shirt|shoes|apparel|jacket|dress)\b/.test(lowerText)) {
    return "clothing";
  }
  if (/\b(electronics|laptop|computer|phone|charger|camera|tablet)\b/.test(lowerText)) {
    return "electronics";
  }
  return "other";
};

export const textToObject = async (text: string): TextToObjectResponse => {
  const date = parseDate(text);
  const total = parseTotal(text);
  if (!date || total === null) {
    return {
      failure: "Could not find the receipt date and total. Try a clearer image.",
    };
  }

  return {
    success: {
      date,
      total,
      category: parseCategory(text),
    },
  };
};
