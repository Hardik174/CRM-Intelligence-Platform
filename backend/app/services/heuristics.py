import re
from typing import Dict, Any, Tuple

SPAM_KEYWORDS = [
    r"boost your seo", r"nigerian prince", r"inheritance", r"wealth transfer",
    r"claim your share", r"lottery winner", r"click here to claim", r"marketing guru",
    r"get on the front page of google", r"make \$\d+ daily"
]

SPAM_DOMAINS = [
    "marketing-guru.io", "spammy-outreach.com", "wealth-transfer.com", "coldoutreach.com"
]

URGENT_KEYWORDS = [
    r"\burgent\b", r"\bp0\b", r"\blegal\b", r"\bcease and desist\b",
    r"\bransomware\b", r"\baction required\b", r"\bbreach\b", r"\bsecurity alert\b",
    r"\bdown\b", r"\bcrashing\b", r"\bdelete my account\b", r"\bfinal warning\b"
]

SECURITY_KEYWORDS = [
    r"suspicious login", r"unauthorized access", r"ransomware",
    r"wallet 1a2b", r"exfiltrated", r"publish the data", r"hacker@",
    r"login attempt", r"breach", r" Pyongyang"
]

INTERNAL_DOMAINS = [
    "internal.com", "mycompany.com"
]

def run_heuristics(subject: str, body: str, sender: str) -> Dict[str, Any]:
    """
    Run fast synchronous pre-filtering on the email contents.
    Returns a dict with triage metrics:
      - is_spam: bool
      - is_internal: bool
      - is_security_threat: bool
      - urgency: str ('Critical' | 'High' | 'Medium' | 'Low')
      - category_override: Optional[str]
    """
    subject_lower = (subject or "").lower()
    body_lower = (body or "").lower()
    sender_lower = (sender or "").lower()
    
    # 1. Internal filter
    is_internal = False
    for domain in INTERNAL_DOMAINS:
        if sender_lower.endswith(f"@{domain}"):
            is_internal = True
            break
            
    # 2. Spam filter
    is_spam = False
    # Check domain
    for domain in SPAM_DOMAINS:
        if sender_lower.endswith(f"@{domain}"):
            is_spam = True
            break
            
    # Check keywords
    if not is_spam:
        combined_text = f"{subject_lower} {body_lower}"
        for kw in SPAM_KEYWORDS:
            if re.search(kw, combined_text):
                is_spam = True
                break
                
    # 3. Security Threat filter
    is_security_threat = False
    combined_text = f"{subject_lower} {body_lower}"
    for kw in SECURITY_KEYWORDS:
        if re.search(kw, combined_text):
            is_security_threat = True
            break
            
    # 4. Urgency Triage
    urgency = "Medium"
    # Check for Critical keywords
    if is_security_threat or "ransomware" in combined_text or "cease and desist" in combined_text or "p0" in combined_text:
        urgency = "Critical"
    elif any(re.search(kw, combined_text) for kw in URGENT_KEYWORDS):
        urgency = "High"
    elif is_spam:
        urgency = "Low"
        
    category_override = None
    if is_spam:
        category_override = "Spam"
    elif is_internal:
        category_override = "Internal"
        
    return {
        "is_spam": is_spam,
        "is_internal": is_internal,
        "is_security_threat": is_security_threat,
        "urgency": urgency,
        "category_override": category_override
    }
