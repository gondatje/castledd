import re
from typing import List

import pdfplumber
import streamlit as st


def extract_pdf_text(file) -> str:
    """Extract text from all pages in the uploaded PDF file."""
    texts: List[str] = []
    with pdfplumber.open(file) as pdf:
        for page in pdf.pages:
            page_text = page.extract_text() or ""
            texts.append(page_text)
    return "\n".join(texts)


def split_guest_blocks(text: str) -> List[str]:
    """Split the concatenated text into guest blocks."""
    blocks = re.split(r"res_detailPage \d+ of 23", text)
    return [block.strip() for block in blocks if block.strip()]


def main() -> None:
    st.title("Castle Hot Springs Guest Data Extractor")

    uploaded_file = st.file_uploader("Upload arrivals report PDF", type="pdf")

    if uploaded_file is not None:
        uploaded_file.seek(0)
        concatenated_text = extract_pdf_text(uploaded_file)
        guest_blocks = split_guest_blocks(concatenated_text)

        st.write(f"Total guest blocks parsed: {len(guest_blocks)}")
    else:
        st.info("Please upload a PDF arrivals report to begin.")


if __name__ == "__main__":
    main()
