export type XlsxCellValue = string | number | null | undefined;

export type XlsxColumn<Row> = {
  header: string;
  width: number;
  value: (row: Row) => XlsxCellValue;
  numberFormat?: "decimal";
};

type ZipEntry = {
  name: string;
  content: string;
};

const encoder = new TextEncoder();

const crcTable = (() => {
  const table = new Uint32Array(256);

  for (let index = 0; index < 256; index += 1) {
    let value = index;

    for (let bit = 0; bit < 8; bit += 1) {
      value =
        (value & 1) !== 0
          ? 0xedb88320 ^ (value >>> 1)
          : value >>> 1;
    }

    table[index] = value >>> 0;
  }

  return table;
})();

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;

  for (const byte of bytes) {
    crc =
      crcTable[(crc ^ byte) & 0xff] ^
      (crc >>> 8);
  }

  return (crc ^ 0xffffffff) >>> 0;
}

function concatBytes(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce(
    (sum, part) => sum + part.length,
    0,
  );

  const output = new Uint8Array(total);
  let offset = 0;

  for (const part of parts) {
    output.set(part, offset);
    offset += part.length;
  }

  return output;
}

function dosDateTime(date: Date): {
  date: number;
  time: number;
} {
  const year = Math.min(
    2107,
    Math.max(1980, date.getFullYear()),
  );

  return {
    date:
      ((year - 1980) << 9) |
      ((date.getMonth() + 1) << 5) |
      date.getDate(),
    time:
      (date.getHours() << 11) |
      (date.getMinutes() << 5) |
      Math.floor(date.getSeconds() / 2),
  };
}

function buildStoredZip(entries: ZipEntry[]): Uint8Array {
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  const timestamp = dosDateTime(new Date());
  let localOffset = 0;

  for (const entry of entries) {
    const nameBytes = encoder.encode(entry.name);
    const dataBytes = encoder.encode(entry.content);
    const checksum = crc32(dataBytes);

    const local = new Uint8Array(
      30 + nameBytes.length + dataBytes.length,
    );
    const localView = new DataView(local.buffer);

    localView.setUint32(0, 0x04034b50, true);
    localView.setUint16(4, 20, true);
    localView.setUint16(6, 0x0800, true);
    localView.setUint16(8, 0, true);
    localView.setUint16(10, timestamp.time, true);
    localView.setUint16(12, timestamp.date, true);
    localView.setUint32(14, checksum, true);
    localView.setUint32(18, dataBytes.length, true);
    localView.setUint32(22, dataBytes.length, true);
    localView.setUint16(26, nameBytes.length, true);
    localView.setUint16(28, 0, true);
    local.set(nameBytes, 30);
    local.set(dataBytes, 30 + nameBytes.length);

    localParts.push(local);

    const central = new Uint8Array(
      46 + nameBytes.length,
    );
    const centralView = new DataView(central.buffer);

    centralView.setUint32(0, 0x02014b50, true);
    centralView.setUint16(4, 20, true);
    centralView.setUint16(6, 20, true);
    centralView.setUint16(8, 0x0800, true);
    centralView.setUint16(10, 0, true);
    centralView.setUint16(12, timestamp.time, true);
    centralView.setUint16(14, timestamp.date, true);
    centralView.setUint32(16, checksum, true);
    centralView.setUint32(20, dataBytes.length, true);
    centralView.setUint32(24, dataBytes.length, true);
    centralView.setUint16(28, nameBytes.length, true);
    centralView.setUint16(30, 0, true);
    centralView.setUint16(32, 0, true);
    centralView.setUint16(34, 0, true);
    centralView.setUint16(36, 0, true);
    centralView.setUint32(38, 0, true);
    centralView.setUint32(42, localOffset, true);
    central.set(nameBytes, 46);

    centralParts.push(central);
    localOffset += local.length;
  }

  const centralDirectory = concatBytes(centralParts);
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);

  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(4, 0, true);
  endView.setUint16(6, 0, true);
  endView.setUint16(8, entries.length, true);
  endView.setUint16(10, entries.length, true);
  endView.setUint32(12, centralDirectory.length, true);
  endView.setUint32(16, localOffset, true);
  endView.setUint16(20, 0, true);

  return concatBytes([
    ...localParts,
    centralDirectory,
    end,
  ]);
}

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function columnName(index: number): string {
  let value = index + 1;
  let result = "";

  while (value > 0) {
    const remainder = (value - 1) % 26;

    result =
      String.fromCharCode(65 + remainder) +
      result;

    value = Math.floor((value - 1) / 26);
  }

  return result;
}

function inlineStringCell(
  reference: string,
  value: string,
  style?: number,
): string {
  const styleAttribute =
    style === undefined ? "" : ` s="${style}"`;

  return (
    `<c r="${reference}" t="inlineStr"${styleAttribute}>` +
    `<is><t xml:space="preserve">${escapeXml(value)}</t></is>` +
    "</c>"
  );
}

function numberCell(
  reference: string,
  value: number,
  style?: number,
): string {
  const styleAttribute =
    style === undefined ? "" : ` s="${style}"`;

  return (
    `<c r="${reference}"${styleAttribute}>` +
    `<v>${Number.isFinite(value) ? value : 0}</v>` +
    "</c>"
  );
}

function createWorksheet<Row>(
  columns: XlsxColumn<Row>[],
  rows: Row[],
): string {
  const lastColumn = columnName(columns.length - 1);
  const lastRow = Math.max(1, rows.length + 1);

  const columnsXml = columns
    .map(
      (column, index) =>
        `<col min="${index + 1}" max="${index + 1}" width="${column.width}" customWidth="1"/>`,
    )
    .join("");

  const headerCells = columns
    .map((column, index) =>
      inlineStringCell(
        `${columnName(index)}1`,
        column.header,
        1,
      ),
    )
    .join("");

  const dataRows = rows
    .map((row, rowIndex) => {
      const excelRow = rowIndex + 2;

      const cells = columns
        .map((column, columnIndex) => {
          const reference =
            `${columnName(columnIndex)}${excelRow}`;
          const value = column.value(row);

          if (
            typeof value === "number" &&
            column.numberFormat === "decimal"
          ) {
            return numberCell(reference, value, 2);
          }

          return inlineStringCell(
            reference,
            value === null || value === undefined
              ? ""
              : String(value),
          );
        })
        .join("");

      return `<row r="${excelRow}">${cells}</row>`;
    })
    .join("");

  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    '<sheetViews><sheetView workbookViewId="0">' +
    '<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>' +
    '</sheetView></sheetViews>' +
    `<cols>${columnsXml}</cols>` +
    `<sheetData><row r="1" ht="24" customHeight="1">${headerCells}</row>${dataRows}</sheetData>` +
    `<autoFilter ref="A1:${lastColumn}${lastRow}"/>` +
    '</worksheet>'
  );
}

function createStyles(): string {
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    '<numFmts count="1"><numFmt numFmtId="164" formatCode="#,##0.00"/></numFmts>' +
    '<fonts count="2">' +
    '<font><sz val="11"/><name val="Calibri"/><family val="2"/></font>' +
    '<font><b/><color rgb="FF081014"/><sz val="11"/><name val="Calibri"/><family val="2"/></font>' +
    '</fonts>' +
    '<fills count="3">' +
    '<fill><patternFill patternType="none"/></fill>' +
    '<fill><patternFill patternType="gray125"/></fill>' +
    '<fill><patternFill patternType="solid"><fgColor rgb="FFBAF16D"/><bgColor indexed="64"/></patternFill></fill>' +
    '</fills>' +
    '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
    '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
    '<cellXfs count="3">' +
    '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
    '<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"><alignment vertical="center"/></xf>' +
    '<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"><alignment horizontal="right"/></xf>' +
    '</cellXfs>' +
    '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
    '</styleSheet>'
  );
}

export function buildXlsxBytes<Row>(options: {
  sheetName: string;
  columns: XlsxColumn<Row>[];
  rows: Row[];
}): Uint8Array {
  if (options.columns.length === 0) {
    throw new Error(
      "At least one Excel column is required.",
    );
  }

  const sheetName =
    options.sheetName
      .replaceAll("[", " ")
      .replaceAll("]", " ")
      .replaceAll(":", " ")
      .replaceAll("*", " ")
      .replaceAll("?", " ")
      .replaceAll("/", " ")
      .replaceAll("\\", " ")
      .trim()
      .slice(0, 31) || "Sheet1";

  return buildStoredZip([
    {
      name: "[Content_Types].xml",
      content:
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
        '<Default Extension="xml" ContentType="application/xml"/>' +
        '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
        '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
        '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
        '</Types>',
    },
    {
      name: "_rels/.rels",
      content:
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
        '</Relationships>',
    },
    {
      name: "xl/workbook.xml",
      content:
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
        `<sheets><sheet name="${escapeXml(sheetName)}" sheetId="1" r:id="rId1"/></sheets>` +
        '</workbook>',
    },
    {
      name: "xl/_rels/workbook.xml.rels",
      content:
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>' +
        '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
        '</Relationships>',
    },
    {
      name: "xl/styles.xml",
      content: createStyles(),
    },
    {
      name: "xl/worksheets/sheet1.xml",
      content: createWorksheet(
        options.columns,
        options.rows,
      ),
    },
  ]);
}

export function downloadXlsx<Row>(options: {
  fileName: string;
  sheetName: string;
  columns: XlsxColumn<Row>[];
  rows: Row[];
}): void {
  const bytes = buildXlsxBytes(options);
  const blob = new Blob(
    [bytes as BlobPart],
    {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    },
  );
  const downloadUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = downloadUrl;
  link.download = options.fileName.endsWith(".xlsx")
    ? options.fileName
    : `${options.fileName}.xlsx`;

  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(downloadUrl);
}
