# REFERENCE FIX v9

Fixed UGC college autocomplete parsing. The current UGC colleges directory table begins with `Sr No`, followed by `Name of the college`, `Affiliated To University`, `College address`, `District`, `State`, and `Status`. The previous parser incorrectly treated the first cell (`Sr No`) as the college name, causing every row to be rejected. v9 maps the table by its actual headers and uses the published column order as a compatibility fallback.

College fetch timeout was increased to 60 seconds because the official UGC page is large. The service also tries the focused official UGC 2(f)/12(B) page if the primary page cannot be fetched or parsed.

A unit test was added to prevent regression.
