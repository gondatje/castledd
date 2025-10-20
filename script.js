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

const extractTextFromPage = async (page) => {
  const textContent = await page.getTextContent();
  return textContent.items
    .map((item) => item.str)
    .join(' ');
};

const parseGuestBlocks = (text) => {
  const blocks = text
    .split('res_detailPage')
    .map((block) => block.trim())
    .filter((block) => block.length > 0);

  return blocks.length;
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
    const guestBlockCount = parseGuestBlocks(combinedText);

    renderResult(`Guest blocks found: ${guestBlockCount}`);
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
