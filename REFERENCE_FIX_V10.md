# REFERENCE FIX v10

Final fix for the UGC college autocomplete parser. The current official UGC colleges table labels the college column `Name of the college`. v9 correctly detected that header but still looked it up as `nameofcollege`, producing column index `-1` and therefore rejecting every institution row. v10 uses `nameofthecollege` consistently.

The parser still supports the published fallback column order and tolerates missing UGC district cells by ranking district matches above district-unknown rows.
