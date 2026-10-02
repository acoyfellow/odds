# Eval run 2026-10-02T10-46-05

Commit `581cf8272d7177c36ac0427d8d05f4a687a301ab`. Command `bun run eval`.

## Is this text a prompt injection?

`deepset/prompt-injections@4f61ecb`, 116 evenly spaced rows from the first 116.

| model | headline | accuracy | AUROC | Brier | MAE | p50 ms | p95 ms | $ / 1k items | errors |
|---|---|---|---|---|---|---|---|---|---|
| clef-flash | accuracy 0.569 | 0.569 | 0.901 | 0.376 |  | 347 | 617 | 0.0171 | 0 |
| clef | accuracy 0.759 | 0.759 | 0.981 | 0.195 |  | 433 | 716 | 0.0456 | 0 |
| llama-3.3-70b | accuracy 0.612 | 0.612 |  |  |  | 384 | 1427 | 0.0366 | 0 |

## Which emotion does the writer express?

`dair-ai/emotion@cab853a`, 300 evenly spaced rows from the first 2000.

| model | headline | accuracy | AUROC | Brier | MAE | p50 ms | p95 ms | $ / 1k items | errors |
|---|---|---|---|---|---|---|---|---|---|
| llama-3.3-70b | macroF1 0.463 | 0.550 |  |  |  | 385 | 1327 | 0.0335 | 12 |
| clef | macroF1 0.528 | 0.590 |  |  |  | 515 | 819 | 0.0534 | 0 |
| clef-flash | macroF1 0.525 | 0.570 |  |  |  | 403 | 563 | 0.0200 | 0 |

## How many stars did this reviewer give?

`Yelp/yelp_review_full@c1f9ee9`, 300 evenly spaced rows from the first 3000.

| model | headline | accuracy | AUROC | Brier | MAE | p50 ms | p95 ms | $ / 1k items | errors |
|---|---|---|---|---|---|---|---|---|---|
| clef | accuracy 0.703 | 0.703 |  |  | 0.31 | 517 | 812 | 0.0830 | 0 |
| llama-3.3-70b | accuracy 0.640 | 0.640 |  |  | 0.40 | 433 | 1339 | 0.0714 | 0 |
| clef-flash | accuracy 0.707 | 0.707 |  |  | 0.31 | 399 | 556 | 0.0311 | 0 |

