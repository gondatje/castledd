const resultDiv = document.getElementById('result');
const fileInput = document.getElementById('pdf-input');

if (!resultDiv || !fileInput) {
  throw new Error('Required DOM elements are missing.');
}

pdfjsLib.GlobalWorkerOptions.workerSrc =
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.10.111/pdf.worker.min.js';

const renderResult = (message) => {
  resultDiv.textContent = message;
};

const ensureTableStyles = () => {
  if (document.getElementById('guest-table-styles')) {
    return;
  }

  const style = document.createElement('style');
  style.id = 'guest-table-styles';
  style.textContent = `
    #result {
      margin-top: 1rem;
    }

    .guest-table-container {
      max-height: 60vh;
      overflow: auto;
      border: 1px solid #ccc;
      border-radius: 4px;
    }

    table.guest-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.9rem;
    }

    table.guest-table th,
    table.guest-table td {
      border: 1px solid #ddd;
      padding: 0.5rem;
      vertical-align: top;
    }

    table.guest-table th {
      position: sticky;
      top: 0;
      background: #f7f7f7;
      z-index: 1;
    }
  `;

  document.head.appendChild(style);
};

const escapeHtml = (value) =>
  String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

const renderGuestTable = (guestData) => {
  if (!guestData || guestData.length === 0) {
    renderResult('No guest blocks found.');
    return;
  }

  ensureTableStyles();

  const headers = [
    'First Name',
    'Last Name',
    'Accompanying Name(s)',
    'Arrival Date',
    'Departure Date',
    'Room Type',
    'VIP',
    'Waiver Status',
    'Special Occasion',
    'Food Allergies',
    'Food Preferences',
    'Special Requests / Special Info',
    'Safety Waivers Needed',
    'Paid Amenities',
    'PA In Progress',
    'Traveling Together',
    'Solo Traveler',
    'Early or Late Arrival',
    'Early or Late Departure',
    'Arrival Transportation',
    'Departure Transportation',
    'Housekeeping Requests / Info',
    'FSV or Split Bed Request',
    'Returning Guest',
    'Package Rate Type',
  ];

  const tableHead = `<thead><tr>${headers
    .map((header) => `<th>${escapeHtml(header)}</th>`)
    .join('')}</tr></thead>`;

  const tableBody = guestData
    .map(
      (entry) =>
        `<tr>${headers
          .map((header) => {
            const key = header
              .toLowerCase()
              .replace(/[^a-z]+/g, ' ')
              .trim()
              .replace(/\s+(\w)/g, (_, char) => char.toUpperCase())
              .replace(/^\w/, (char) => char.toLowerCase());

            return `<td>${escapeHtml(entry[key] || '')}</td>`;
          })
          .join('')}</tr>`
    )
    .join('');

  const table = `<div class="guest-table-container"><table class="guest-table">${tableHead}<tbody>${tableBody}</tbody></table></div>`;

  resultDiv.innerHTML = table;
};

const extractTextFromPage = async (page) => {
  const textContent = await page.getTextContent();
  return textContent.items
    .map((item) => item.str)
    .join(' ');
};

const parseGuestBlocks = (text) => {
  const rawBlocks = text
    .split(/res_detailPage/i)
    .map((block) => block.trim())
    .filter((block) => block.length > 0);

  return rawBlocks.map((block) => extractGuestData(block));
};

const findValueByLabels = (lines, labels) => {
  for (const line of lines) {
    for (const label of labels) {
      if (line.toLowerCase().startsWith(label.toLowerCase())) {
        return line
          .slice(label.length)
          .replace(/^[:\-\s]+/, '')
          .trim();
      }
    }
  }
  return '';
};

const parseName = (value) => {
  if (!value) {
    return { firstName: '', lastName: '' };
  }

  const cleaned = value
    .replace(/Guest(?: Name)?[:\-]?/i, '')
    .replace(/Primary/i, '')
    .replace(/\b(Mr|Mrs|Ms|Dr|Mx)\.?\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleaned) {
    return { firstName: '', lastName: '' };
  }

  if (cleaned.includes('/')) {
    const [last, first] = cleaned.split('/').map((part) => part.trim());
    return {
      firstName: first ? first.split(' ')[0] : '',
      lastName: last || '',
    };
  }

  if (cleaned.includes(',')) {
    const [last, first] = cleaned.split(',').map((part) => part.trim());
    return {
      firstName: first ? first.split(' ')[0] : '',
      lastName: last || '',
    };
  }

  const parts = cleaned.split(' ');
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: '' };
  }

  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
};

const gatherMatchingLines = (lines, patterns) =>
  lines
    .filter((line) => patterns.some((pattern) => pattern.test(line)))
    .map((line) => line.replace(/^.*?:\s*/, '').trim());

const parseTimeFromText = (text) => {
  if (!text) {
    return null;
  }

  const match = text.match(/(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?/i);
  if (!match) {
    return null;
  }

  let [hours, minutes, meridiem] = [
    parseInt(match[1], 10),
    match[2] ? parseInt(match[2], 10) : 0,
    match[3],
  ];

  if (Number.isNaN(hours) || Number.isNaN(minutes)) {
    return null;
  }

  if (meridiem) {
    const upperMeridiem = meridiem.toUpperCase();
    if (upperMeridiem === 'PM' && hours < 12) {
      hours += 12;
    }
    if (upperMeridiem === 'AM' && hours === 12) {
      hours = 0;
    }
  }

  if (!meridiem && hours < 7) {
    // assume times before 7 are likely evening (19-23)
    hours += 12;
  }

  return hours * 60 + minutes;
};

const evaluateArrivalDeparture = (label, timeText) => {
  const minutes = parseTimeFromText(timeText);
  if (minutes == null) {
    return '';
  }

  const formatted = timeText.trim();
  if (label === 'arrival') {
    if (minutes < 12 * 60) {
      return `Early Arrival (${formatted})`;
    }
    if (minutes > 18 * 60) {
      return `Late Arrival (${formatted})`;
    }
  } else {
    if (minutes < 8 * 60) {
      return `Early Departure (${formatted})`;
    }
    if (minutes > 17 * 60) {
      return `Late Departure (${formatted})`;
    }
  }

  return '';
};

const detectPaidAmenities = (block, lines) => {
  const keywords = [
    'spa',
    'via ferrata',
    'mixology',
    'horseback',
    'fly fishing',
    'guided hike',
    'climbing',
    'axe throwing',
    'yoga',
  ];

  const matches = new Set();
  for (const line of lines) {
    const lowerLine = line.toLowerCase();
    keywords.forEach((keyword) => {
      if (lowerLine.includes(keyword)) {
        matches.add(line.trim());
      }
    });
  }

  if (matches.size === 0 && /\bspa\b/i.test(block)) {
    matches.add('SPA');
  }

  return Array.from(matches).join('; ');
};

const detectPackageRateType = (block) => {
  const patterns = [
    'Amex',
    'Inspirato',
    'Virtuoso',
    'COMP',
    'F&F',
    'Friends & Family',
    'Package',
    'Promo',
  ];

  const found = patterns.filter((pattern) =>
    block.toLowerCase().includes(pattern.toLowerCase())
  );

  return found.join(', ');
};

const extractGuestData = (block) => {
  const normalizedBlock = block.replace(/\s{2,}/g, '\n');
  const lines = normalizedBlock
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  const guestLine = lines.find((line) => /Guest(?: Name)?/i.test(line)) || '';
  const { firstName, lastName } = parseName(guestLine || lines[0] || '');

  const accompanyingNames = gatherMatchingLines(lines, [
    /Accompanying/i,
    /Guest\s*\d+/i,
    /Additional Guest/i,
    /Companion/i,
  ]).join('; ');

  const arrivalDate = findValueByLabels(lines, [
    'Arrival Date',
    'Arrive Date',
    'Arrival',
  ]);

  const departureDate = findValueByLabels(lines, [
    'Departure Date',
    'Depart Date',
    'Departure',
  ]);

  const roomType = findValueByLabels(lines, [
    'Room Type',
    'Room',
    'Accommodation',
  ]);

  const waiverStatus = findValueByLabels(lines, ['Waiver']);
  const specialOccasion = findValueByLabels(lines, ['SPC OCC', 'Special Occasion']);
  const allergies = findValueByLabels(lines, ['Allergies']);
  const dietaryPreference = findValueByLabels(lines, ['Dietary Preference']);

  const specialInfoLines = gatherMatchingLines(lines, [
    /Special requests?/i,
    /Guest has/i,
    /Notes?/i,
    /Important/i,
  ]);

  const paidAmenities = detectPaidAmenities(block, lines);
  const reservationStatus = findValueByLabels(lines, [
    'Reservation Status',
    'Status',
  ]);

  const travelingTogether = gatherMatchingLines(lines, [/Traveling with/i]).join(', ');

  const arrivalEta = findValueByLabels(lines, ['ETA', 'Arrival ETA', 'Arr ETA']);
  const departureEtd = findValueByLabels(lines, ['ETD', 'Departure ETD', 'Dep ETD']);

  const arrivalTransportLines = gatherMatchingLines(lines, [
    /Driver/i,
    /Helicopter/i,
    /Flight/i,
    /Airlines?/i,
    /Transfer/i,
  ]);

  const departureTransportLines = gatherMatchingLines(lines, [
    /Departure.*Driver/i,
    /Departure.*Flight/i,
    /Return Flight/i,
    /Departing via/i,
  ]);

  const housekeepingInfo = gatherMatchingLines(lines, [
    /Housekeeping/i,
    /Room setup/i,
    /Turn ?down/i,
    /Pillow/i,
    /Rollaway/i,
    /Crib/i,
  ]).join('; ');

  const fsvOrSplit =
    /fsv/i.test(roomType) ||
    lines.some((line) => /split bed/i.test(line))
      ? 'Yes'
      : '';

  const returningGuest = block.match(/Returning Guest/i) ? 'Yes' : '';

  const packageRateType = detectPackageRateType(block);

  const safetyWaiversNeeded = waiverStatus
    ? /complete/i.test(waiverStatus)
      ? 'No'
      : 'Yes'
    : '';

  const paInProgress = reservationStatus
    ? /PA\s*(?:\(Completed\)|Complete)/i.test(reservationStatus)
      ? 'No'
      : 'Yes'
    : '';

  const arrivalTiming = evaluateArrivalDeparture('arrival', arrivalEta);
  const departureTiming = evaluateArrivalDeparture('departure', departureEtd);

  const soloTraveler = !accompanyingNames && !travelingTogether ? 'Yes' : '';

  return {
    firstName,
    lastName,
    accompanyingNameS: accompanyingNames,
    arrivalDate,
    departureDate,
    roomType,
    vip: /\bVIP\b/i.test(block) ? 'Yes' : '',
    waiverStatus,
    specialOccasion,
    foodAllergies: allergies,
    foodPreferences: dietaryPreference,
    specialRequestsSpecialInfo: specialInfoLines.join('; '),
    safetyWaiversNeeded,
    paidAmenities,
    paInProgress,
    travelingTogether,
    soloTraveler,
    earlyOrLateArrival: arrivalTiming,
    earlyOrLateDeparture: departureTiming,
    arrivalTransportation: arrivalTransportLines.join('; '),
    departureTransportation: departureTransportLines.join('; '),
    housekeepingRequestsInfo: housekeepingInfo,
    fsvOrSplitBedRequest: fsvOrSplit,
    returningGuest,
    packageRateType,
  };
};

const handleFile = async (file) => {
  if (!file) {
    renderResult('Please select a PDF file to process.');
    return;
  }

  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    const pageTexts = [];
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const text = await extractTextFromPage(page);
      pageTexts.push(text);
    }

    const combinedText = pageTexts.join('\n');
    const guestData = parseGuestBlocks(combinedText);

    renderGuestTable(guestData);
  } catch (error) {
    console.error(error);
    renderResult('An error occurred while processing the PDF.');
  }
};

fileInput.addEventListener('change', (event) => {
  const [file] = event.target.files || [];

  if (file && file.type !== 'application/pdf') {
    renderResult('Only PDF files are supported.');
    return;
  }

  handleFile(file);
});
