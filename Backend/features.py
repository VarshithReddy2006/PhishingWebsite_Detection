import ipaddress
import math
import os
import re
from urllib.parse import urlparse

FEATURE_COLUMNS = [
    "length_url",
    "length_hostname",
    "nb_dots",
    "nb_hyphens",
    "nb_at",
    "nb_qm",
    "nb_and",
    "nb_or",
    "nb_eq",
    "nb_underscore",
    "nb_tilde",
    "nb_percent",
    "nb_slash",
    "nb_star",
    "nb_colon",
    "nb_comma",
    "nb_semicolon",
    "nb_dollar",
    "nb_space",
    "nb_www",
    "nb_com",
    "ratio_digits_url",
    "ratio_digits_host",
    "has_ip",
    "tld_in_path",
    "tld_in_subdomain",
    "abnormal_subdomain",
    "nb_subdomains",
    "prefix_suffix",
    "shortening_service",
    "path_extension",
    "https_token",
    "random_domain",
    # Domain reputation features
    "domain_length",
    "tld_risk_score",
    "subdomain_count",
    "entropy_score",
    # Additional URL-derived features for higher accuracy
    "punycode",
    "port",
    "nb_dslash",
    "http_in_path",
    "phish_hints",
    "suspecious_tld",
    "char_repeat",
    "length_words_raw",
    "shortest_words_raw",
    "longest_words_raw",
    "avg_words_raw",
    "path_depth",
    "has_port",
    "digit_letter_ratio",
    "nb_redirection",
    "shortest_word_host",
    "shortest_word_path",
    "longest_word_host",
    "longest_word_path",
    "avg_word_host",
    "avg_word_path",
]

# DistilBERT is lazy-loaded only when training functions are called.
# This keeps backend startup fast (<2s) by never importing torch at module level.
_bert_model = None
_bert_tokenizer = None
_bert_device = None

_HIGH_RISK_TLDS = {
    "xyz", "tk", "ml", "ga", "cf", "gq", "top", "buzz", "club",
    "work", "loan", "click", "link", "info", "online", "site",
    "wang", "win", "bid", "stream", "racing", "review", "download",
    "country", "cricket", "science", "party", "date", "faith",
    "accountant", "men", "trade",
}

_SUSPICIOUS_TLDS = _HIGH_RISK_TLDS | {"fit", "gp", "to", "surf"}

_PHISH_KEYWORDS = {
    "login", "signin", "verify", "secure", "account", "update",
    "confirm", "banking", "password", "credential", "suspend",
    "unusual", "expire", "unlock", "authenticate", "wallet",
}

_LOW_RISK_TLDS = {
    "com", "org", "edu", "gov", "net", "mil", "int",
}

_SHORTENERS = {
    "bit.ly",
    "tinyurl.com",
    "t.co",
    "goo.gl",
    "is.gd",
    "buff.ly",
    "ow.ly",
    "adf.ly",
    "bit.do",
    "tr.im",
    "tiny.cc",
}

_SUSPICIOUS_EXTENSIONS = {
    ".exe",
    ".zip",
    ".rar",
    ".7z",
    ".js",
    ".php",
    ".html",
    ".htm",
    ".jsp",
    ".asp",
    ".aspx",
}


def check_https(url):
    parsed = urlparse(url)
    return 1 if parsed.scheme.lower() == "https" else 0


def detect_ip(hostname):
    try:
        ipaddress.ip_address(hostname)
        return 1
    except ValueError:
        return 0


def _get_hostname(parsed):
    return parsed.hostname or ""


def _get_tld_parts(hostname):
    parts = hostname.split(".")
    if len(parts) < 2:
        return "", []
    return parts[-1], parts[:-1]


def _entropy_score(text):
    if not text:
        return 0.0
    counts = {}
    for ch in text:
        counts[ch] = counts.get(ch, 0) + 1
    length = len(text)
    entropy = 0.0
    for count in counts.values():
        p = count / length
        entropy -= p * math.log(p, 2)
    return entropy


def _tld_risk_score(tld):
    """Score TLD risk: 0.0 = low risk, 0.5 = medium, 1.0 = high risk."""
    tld = tld.lower().strip(".")
    if tld in _LOW_RISK_TLDS:
        return 0.0
    if tld in _HIGH_RISK_TLDS:
        return 1.0
    return 0.5


def extract_features(url):
    parsed = urlparse(url)
    hostname = _get_hostname(parsed)
    path = parsed.path or ""
    tld, subdomain_parts = _get_tld_parts(hostname)

    domain_parts = hostname.split(".")
    domain_name = domain_parts[-2] if len(domain_parts) >= 2 else hostname

    digits_url = sum(ch.isdigit() for ch in url)
    digits_host = sum(ch.isdigit() for ch in hostname)

    nb_subdomains = max(len(domain_parts) - 2, 0) if hostname else 0

    tld_in_path = 1 if tld and tld in path.lower() else 0
    tld_in_subdomain = 1 if tld and any(tld in part for part in subdomain_parts) else 0

    abnormal_subdomain = 0
    if nb_subdomains >= 3:
        abnormal_subdomain = 1
    if hostname.startswith(("http", "https")):
        abnormal_subdomain = 1
    if re.search(r"\d{2,}", hostname) and "-" in hostname:
        abnormal_subdomain = 1

    prefix_suffix = 1 if "-" in domain_name else 0

    ext = os.path.splitext(path)[1].lower()
    path_extension = 1 if ext in _SUSPICIOUS_EXTENSIONS else 0

    https_token = 1 if parsed.scheme.lower() == "https" else 0

    entropy = _entropy_score(hostname.replace(".", ""))
    random_domain = 1 if entropy >= 3.5 else 0

    domain_len = len(domain_name)
    tld_risk = _tld_risk_score(tld)

    # Punycode detection
    punycode = 1 if "xn--" in hostname.lower() else 0

    # Port detection
    port_num = parsed.port
    has_port = 1 if port_num and port_num not in (80, 443) else 0
    port_val = port_num if port_num else 0

    # Double slash in path
    nb_dslash = max(url.count("//") - 1, 0)

    # HTTP in path
    http_in_path = 1 if "http" in path.lower() else 0

    # Phishing hint keywords
    url_lower = url.lower()
    phish_hints = sum(1 for kw in _PHISH_KEYWORDS if kw in url_lower)

    # Suspicious TLD
    suspecious_tld = 1 if tld.lower() in _SUSPICIOUS_TLDS else 0

    # Character repeat (max consecutive same chars)
    char_repeat = 0
    if url:
        cur_count = 1
        for ci in range(1, len(url)):
            if url[ci] == url[ci - 1]:
                cur_count += 1
                char_repeat = max(char_repeat, cur_count)
            else:
                cur_count = 1
        char_repeat = max(char_repeat, cur_count)

    # Word-length features from URL
    words = re.split(r"[^a-zA-Z]+", url)
    words = [w for w in words if w]
    length_words_raw = len(words)
    word_lens = [len(w) for w in words] if words else [0]
    shortest_words_raw = min(word_lens)
    longest_words_raw = max(word_lens)
    avg_words_raw = round(sum(word_lens) / len(word_lens), 2) if word_lens else 0

    # Path depth
    path_depth = len([p for p in path.split("/") if p])

    # Digit to letter ratio
    letters = sum(c.isalpha() for c in url)
    digit_letter_ratio = round(digits_url / letters, 4) if letters else 0.0

    # Word-level features for host and path
    host_words = re.split(r"[^a-zA-Z]+", hostname)
    host_words = [w for w in host_words if w]
    hw_lens = [len(w) for w in host_words] if host_words else [0]
    shortest_word_host = min(hw_lens)
    longest_word_host = max(hw_lens)
    avg_word_host = round(sum(hw_lens) / len(hw_lens), 2) if hw_lens else 0

    path_words = re.split(r"[^a-zA-Z]+", path)
    path_words = [w for w in path_words if w]
    pw_lens = [len(w) for w in path_words] if path_words else [0]
    shortest_word_path = min(pw_lens)
    longest_word_path = max(pw_lens)
    avg_word_path = round(sum(pw_lens) / len(pw_lens), 2) if pw_lens else 0

    return {
        "length_url": len(url),
        "length_hostname": len(hostname),
        "nb_dots": url.count("."),
        "nb_hyphens": url.count("-"),
        "nb_at": url.count("@"),
        "nb_qm": url.count("?"),
        "nb_and": url.count("&"),
        "nb_or": url.count("|"),
        "nb_eq": url.count("="),
        "nb_underscore": url.count("_"),
        "nb_tilde": url.count("~"),
        "nb_percent": url.count("%"),
        "nb_slash": url.count("/"),
        "nb_star": url.count("*"),
        "nb_colon": url.count(":"),
        "nb_comma": url.count(","),
        "nb_semicolon": url.count(";"),
        "nb_dollar": url.count("$"),
        "nb_space": url.count(" "),
        "nb_www": url.lower().count("www"),
        "nb_com": url.lower().count(".com"),
        "ratio_digits_url": digits_url / len(url) if url else 0.0,
        "ratio_digits_host": digits_host / len(hostname) if hostname else 0.0,
        "has_ip": detect_ip(hostname),
        "tld_in_path": tld_in_path,
        "tld_in_subdomain": tld_in_subdomain,
        "abnormal_subdomain": abnormal_subdomain,
        "nb_subdomains": nb_subdomains,
        "prefix_suffix": prefix_suffix,
        "shortening_service": 1 if hostname.lower() in _SHORTENERS else 0,
        "path_extension": path_extension,
        "https_token": https_token,
        "random_domain": random_domain,
        # Domain reputation features
        "domain_length": domain_len,
        "tld_risk_score": tld_risk,
        "subdomain_count": nb_subdomains,
        "entropy_score": round(entropy, 4),
        # Additional URL-derived features
        "punycode": punycode,
        "port": port_val,
        "nb_dslash": nb_dslash,
        "http_in_path": http_in_path,
        "phish_hints": phish_hints,
        "suspecious_tld": suspecious_tld,
        "char_repeat": char_repeat,
        "length_words_raw": length_words_raw,
        "shortest_words_raw": shortest_words_raw,
        "longest_words_raw": longest_words_raw,
        "avg_words_raw": avg_words_raw,
        "path_depth": path_depth,
        "has_port": has_port,
        "digit_letter_ratio": digit_letter_ratio,
        "nb_redirection": nb_dslash,
        "shortest_word_host": shortest_word_host,
        "shortest_word_path": shortest_word_path,
        "longest_word_host": longest_word_host,
        "longest_word_path": longest_word_path,
        "avg_word_host": avg_word_host,
        "avg_word_path": avg_word_path,
    }


def get_structural_features(url, expected_features=None):
    features = extract_features(url)
    if expected_features is None:
        expected_features = FEATURE_COLUMNS
    return [features.get(name, 0) for name in expected_features]


# ── DistilBERT (lazy-loaded, training only) ──────────────────────────────────
# These functions load DistilBERT on first call.  They must NOT be called from
# app.py to keep backend startup fast (<2 seconds).

def _load_bert():
    """Lazy-load DistilBERT model and tokenizer on first call."""
    global _bert_model, _bert_tokenizer, _bert_device
    if _bert_model is not None:
        return
    import torch
    from transformers import DistilBertModel, DistilBertTokenizer

    requested = os.getenv("PHISHGUARD_DEVICE", "cpu").strip().lower()
    _bert_device = torch.device(
        "cuda" if requested == "cuda" and torch.cuda.is_available() else "cpu"
    )
    print(f"Loading DistilBERT on {_bert_device}...", flush=True)
    _bert_tokenizer = DistilBertTokenizer.from_pretrained("distilbert-base-uncased")
    _bert_model = DistilBertModel.from_pretrained("distilbert-base-uncased")
    _bert_model.to(_bert_device)
    _bert_model.eval()
    print("DistilBERT ready.", flush=True)


def get_bert_embedding(text):
    """Compute single CLS embedding.  Lazy-loads DistilBERT."""
    import torch
    _load_bert()
    inputs = _bert_tokenizer(
        text,
        return_tensors="pt",
        truncation=True,
        padding=True,
        max_length=32,
    )
    inputs = {k: v.to(_bert_device) for k, v in inputs.items()}
    with torch.no_grad():
        outputs = _bert_model(**inputs)
    cls_embedding = outputs.last_hidden_state[:, 0, :]
    return cls_embedding.squeeze().detach().cpu().tolist()


def get_bert_embeddings_batch(texts, batch_size=64, cache=None):
    """Compute CLS embeddings for multiple strings with optional caching.

    Args:
        texts: list of URL strings
        batch_size: batch size for tokenization (default 64)
        cache: optional dict {url: embedding_vector} for reuse

    Returns:
        list of embedding vectors
    """
    import torch
    _load_bert()

    if not texts:
        return []

    embeddings = [None] * len(texts)
    uncached_indices = []
    uncached_texts = []

    for i, text in enumerate(texts):
        if cache is not None and text in cache:
            embeddings[i] = cache[text]
        else:
            uncached_indices.append(i)
            uncached_texts.append(text)

    cached_count = len(texts) - len(uncached_texts)
    if uncached_texts:
        print(
            f"Computing {len(uncached_texts)} new embeddings "
            f"({cached_count} cached) in batches of {batch_size}...",
            flush=True,
        )
        for start in range(0, len(uncached_texts), batch_size):
            batch = uncached_texts[start : start + batch_size]
            inputs = _bert_tokenizer(
                batch,
                return_tensors="pt",
                truncation=True,
                padding=True,
                max_length=32,
            )
            inputs = {k: v.to(_bert_device) for k, v in inputs.items()}
            with torch.no_grad():
                outputs = _bert_model(**inputs)
            cls = outputs.last_hidden_state[:, 0, :].detach().cpu().numpy()
            for j, vec in enumerate(cls.tolist()):
                idx = uncached_indices[start + j]
                embeddings[idx] = vec
                if cache is not None:
                    cache[uncached_texts[start + j]] = vec
    elif cached_count:
        print(f"All {cached_count} embeddings loaded from cache.", flush=True)

    return embeddings
