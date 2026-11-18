"""Count sentence boundaries in the German scene body, excluding metadata and quiz."""
import re


def sentence_count(paragraphs: list[str]) -> int:
    total = 0
    for paragraph in paragraphs:
        text = paragraph.strip()
        if not text:
            continue
        # Protect common abbreviations and decimal numbers before counting boundaries.
        text = re.sub(r'\b(?:z\.\s*B\.|d\.\s*h\.|u\.\s*a\.|bzw\.|usw\.|Dr\.|Prof\.|Nr\.|ca\.)', lambda m: m[0].replace('.', '∯'), text)
        text = re.sub(r'(?<=\d)\.(?=\d)', '∯', text)
        # An initial such as H. is not a sentence boundary when followed by more text.
        text = re.sub(r'\b[A-ZÄÖÜ]\.(?=\s+[a-zäöü])', lambda m: m[0].replace('.', '∯'), text)
        chunks = re.split(r'[.!?]+[»”"\u2019\u201c]*(?:\s+|$)', text)
        total += sum(bool(re.search(r'\w', chunk)) for chunk in chunks)
    return total
