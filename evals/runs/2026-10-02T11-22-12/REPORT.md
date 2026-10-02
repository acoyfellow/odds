# Eval run 2026-10-02T11-22-12

Commit `e9e32cd0de2947c4aee0873e69537c4d6e6de983`. Command `bun run eval`.

## Is this text a prompt injection?

`deepset/prompt-injections@4f61ecb`, 116 evenly spaced rows from the first 116.

| model | headline | accuracy | AUROC | Brier | MAE | p50 ms | p95 ms | $ / 1k items | errors |
|---|---|---|---|---|---|---|---|---|---|
| clef-flash | accuracy 0.569 | 0.569 | 0.901 | 0.376 |  | 380 | 626 | 0.0171 | 0 |
| clef | accuracy 0.759 | 0.759 | 0.981 | 0.195 |  | 654 | 1199 | 0.0456 | 0 |
| llama-3.3-70b | accuracy 0.612 | 0.612 |  |  |  | 404 | 1642 | 0.0366 | 0 |

## Which emotion does the writer express?

`dair-ai/emotion@cab853a`, 300 evenly spaced rows from the first 2000.

| model | headline | accuracy | AUROC | Brier | MAE | p50 ms | p95 ms | $ / 1k items | errors |
|---|---|---|---|---|---|---|---|---|---|
| llama-3.3-70b | macroF1 0.457 | 0.537 |  |  |  | 463 | 2947 | 0.0327 | 20 |
| clef | macroF1 0.528 | 0.590 |  |  |  | 569 | 1006 | 0.0534 | 0 |
| clef-flash | macroF1 0.525 | 0.570 |  |  |  | 384 | 724 | 0.0200 | 0 |

## How many stars did this reviewer give?

`Yelp/yelp_review_full@c1f9ee9`, 300 evenly spaced rows from the first 3000.

| model | headline | accuracy | AUROC | Brier | MAE | p50 ms | p95 ms | $ / 1k items | errors |
|---|---|---|---|---|---|---|---|---|---|
| clef | accuracy 0.703 | 0.703 |  |  | 0.31 | 590 | 938 | 0.0830 | 0 |
| llama-3.3-70b | accuracy 0.640 | 0.640 |  |  | 0.40 | 472 | 1282 | 0.0714 | 0 |
| clef-flash | accuracy 0.707 | 0.707 |  |  | 0.31 | 515 | 1203 | 0.0311 | 0 |

