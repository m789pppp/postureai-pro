"""
auth/middleware.py's domain/email-based elite auto-elevation.

This is the SERVER-SIDE gate every actually-enforced elite feature (AI
Coach limits, backend-assisted analysis, etc.) reads. frontend/src/
firebase.js keeps its own duplicate copy for client-side display, with
a comment saying it "mirrors backend middleware" -- it didn't: that copy
had coventry.ac.uk/coventry-university.ac.uk/city.ac.uk and
support@corvus.io that this file was missing entirely. Commit history
("state the real Coventry pilot") confirms Coventry is a genuine
institutional partner, not placeholder data, so those pilot users were
shown Elite-tier UI the backend would not actually grant -- the opposite
direction from every other engine-parity gap this audit found (frontend
ahead here, not behind).

Run: cd backend && pytest tests/test_elite_elevation.py -v
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from auth.middleware import _should_elevate_to_elite, ELITE_DOMAINS, ELITE_EMAILS


class TestInstitutionalDomains:
    """Each of these is a real partner per the project's own commit
    history, not a placeholder -- pinned individually so a future
    refactor of ELITE_DOMAINS can't silently drop one."""

    def test_the_knowledge_hub(self):
        assert _should_elevate_to_elite("student@tkh.edu.eg")

    def test_coventry_university(self):
        assert _should_elevate_to_elite("researcher@coventry.ac.uk")

    def test_coventry_university_alt_domain(self):
        assert _should_elevate_to_elite("researcher@coventry-university.ac.uk")

    def test_city_university_of_london(self):
        assert _should_elevate_to_elite("researcher@city.ac.uk")

    def test_subdomain_of_a_partner_domain_also_qualifies(self):
        # _should_elevate_to_elite matches domain suffixes, so a
        # department subdomain of a partner institution should too.
        assert _should_elevate_to_elite("student@cs.coventry.ac.uk")

    def test_unrelated_domain_does_not_qualify(self):
        assert not _should_elevate_to_elite("someone@gmail.com")
        assert not _should_elevate_to_elite("someone@notcoventry.ac.uk")


class TestIndividualEmails:
    def test_founder_accounts(self):
        assert _should_elevate_to_elite("judyayman36@gmail.com")
        assert _should_elevate_to_elite("m789pppp@gmail.com")

    def test_internal_support_account(self):
        assert _should_elevate_to_elite("support@corvus.io")

    def test_case_insensitive(self):
        assert _should_elevate_to_elite("Support@Corvus.IO")
        assert _should_elevate_to_elite("Researcher@Coventry.AC.UK")


class TestEdgeCases:
    def test_empty_or_missing_email(self):
        assert not _should_elevate_to_elite("")
        assert not _should_elevate_to_elite(None)

    def test_malformed_email_without_at_sign(self):
        assert not _should_elevate_to_elite("not-an-email")


class TestFrontendParity:
    """Pins the exact set this file must keep matching
    frontend/src/firebase.js's own duplicate (_ELITE_DOMAINS/_ELITE_EMAILS)
    -- the drift this whole test file exists to catch again if it recurs."""

    def test_domains_match_frontends_copy(self):
        frontend_domains = {
            "coventry.ac.uk", "coventry-university.ac.uk",
            "city.ac.uk", "tkh.edu.eg",
        }
        assert set(d.lower() for d in ELITE_DOMAINS) == frontend_domains

    def test_emails_match_frontends_copy(self):
        frontend_emails = {
            "judyayman36@gmail.com", "support@corvus.io", "m789pppp@gmail.com",
        }
        assert set(e.lower() for e in ELITE_EMAILS) == frontend_emails
