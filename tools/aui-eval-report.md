# AUI golden-set report

Generated against the ~24.5k-entry catalog with the two-stage reasoning worker (understand → retrieve → decide, one retry when the first round finds no exact fit).
Positive cases accept any of several domain-correct plugins; negatives must stay quiet.

| threshold | hits | wrong | missed | false positives | accuracy | precision | recall |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 0.5 | 23/26 | 0 | 3 | 0/10 | 91.7% | 100.0% | 88.5% |
| 0.6 | 23/26 | 0 | 3 | 0/10 | 91.7% | 100.0% | 88.5% |
| 0.7 | 22/26 | 0 | 4 | 0/10 | 88.9% | 100.0% | 84.6% |
| 0.8 | 19/26 | 0 | 7 | 0/10 | 80.6% | 100.0% | 73.1% |

## Per case (threshold 0.6)

| id | kind | suggested | plugin | fit | verdict |
| --- | --- | --- | --- | ---: | --- |
| excel-formula | positive | True | hccccc01333/dsh-excel-chat | 0.72 | hit |
| office-ui | positive | True | dream-num/dsh-univer-office | 0.80 | hit |
| context-panel | positive | True | mounta1n-18/dsh-context-usage | 0.86 | hit |
| better-sidebar | positive | False | — | 0.25 | quiet (no exact fit) |
| worktable | positive | True | Qianrushixiaobai/dsh-agentmonitor | 0.86 | hit |
| browser-op | positive | True | titanwings/dsh-better-browser | 0.90 | hit |
| xhs-collect | positive | True | nataliwhite20534-droid/dsh-xhs-collector | 0.90 | hit |
| xhs-video-watermark | positive | True | hzwym8912-code/dsh-everything-down | 0.90 | hit |
| bili-daily | positive | False | — | 0.08 | quiet (no exact fit) |
| memory | positive | True | hr98w/dsh-memory | 0.86 | hit |
| lark-bot | positive | True | xmanrui/dsh-im | 0.85 | hit |
| email | positive | True | STARDUSTLC666/dsh-email | 0.95 | hit |
| meeting-minutes | positive | True | zhangguitao666/meeting-suite | 0.82 | hit |
| tts | positive | True | 1624318455/dsh-plugin-tts | 0.95 | hit |
| voice-input | positive | True | chentao4183/dsh-voice-suite | 0.85 | hit |
| cron | positive | True | uluckystar/dsh-schedule-tasks | 0.86 | hit |
| paper-reader | positive | True | GGboya/dsh-paper-reader | 0.95 | hit |
| chart | positive | True | lxfu1/dsh-plugin-chart | 0.72 | hit |
| sales-crm | positive | False | — | 0.10 | quiet (no exact fit) |
| subscriptions | positive | True | V1ki/dsh-plugin-subscriptions | 0.93 | hit |
| usage-cost | positive | True | Jun-Jun-Gao/dsh-token-usage-panel | 0.60 | hit |
| pocket-remote | positive | True | liguobao/ds-harness-remote | 0.90 | hit |
| pptx | positive | True | TANGZHUO12/ppt-expert | 0.76 | hit |
| ocr | positive | True | grelvan/dsh-ocr-local | 0.90 | hit |
| emoji | positive | True | hellodigua/dsh-emoji | 0.95 | hit |
| pdf-translate | positive | True | l2685209197/dsh-pdf-translate | 0.86 | hit |
| chitchat | negative | False | — | 0.00 | correctly quiet |
| coding | negative | False | — | 0.00 | correctly quiet |
| concept | negative | False | — | 0.00 | correctly quiet |
| poem | negative | False | — | 0.00 | correctly quiet |
| debug | negative | False | — | 0.00 | correctly quiet |
| date | negative | False | — | 0.00 | correctly quiet |
| summarize-chat | negative | False | — | 0.00 | correctly quiet |
| math | negative | False | — | 0.00 | correctly quiet |
| naming | negative | False | — | 0.00 | correctly quiet |
| opinion | negative | False | — | 0.00 | correctly quiet |

Average decision latency: ~4.4 s (two model calls; trivial messages skip the second call via the worthiness gate).
Remaining gaps are strict-fit rejections: `better-sidebar`, `bili-daily` and `sales-crm` have no single plugin that covers the whole request, so AUI stays quiet instead of suggesting a partial match.

