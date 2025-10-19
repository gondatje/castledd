
# Pseudocode test; Codex to finish once gold file is available.
# Idea: run dd_build on 10/19 AD + MASTER and compare values-only to your 10/19 gold.

import subprocess, filecmp, os


def test_build_1019_values_only(tmp_path):
    # Codex: implement a cell-by-cell compare ignoring styles
    assert True
