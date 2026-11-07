# AUI golden-set report

Generated against the ~24.5k-entry catalog (2026-11-07 snapshot) with the default model judge (temperature 0, 700-token budget, 15 recalled candidates).
Positive cases accept any of several domain-correct plugins; negatives must stay quiet.

| threshold | hits | wrong | missed | false positives | accuracy | precision | recall |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 0.5 | 25/26 | 0 | 1 | 0/10 | 97.2% | 100.0% | 96.2% |
| 0.6 | 25/26 | 0 | 1 | 0/10 | 97.2% | 100.0% | 96.2% |
| 0.7 | 21/26 | 0 | 5 | 0/10 | 86.1% | 100.0% | 80.8% |
| 0.8 | 18/26 | 0 | 8 | 0/10 | 77.8% | 100.0% | 69.2% |

## Per case (threshold 0.6)

| id | kind | suggested | plugin | confidence | verdict |
| --- | --- | --- | --- | ---: | --- |
| excel-formula | positive | True | zirscard/dsh-office-audit | 0.62 | hit |
| office-ui | positive | True | dream-num/dsh-univer-office | 0.62 | hit |
| context-panel | positive | True | bowenliang123/dsh-context | 0.85 | hit |
| better-sidebar | positive | True | tingfeng347/dsh-vscode-workbench | 0.93 | hit |
| worktable | positive | True | Qianrushixiaobai/dsh-agentmonitor | 0.82 | hit |
| browser-op | positive | True | titanwings/dsh-better-browser | 0.82 | hit |
| xhs-collect | positive | True | nataliwhite20534-droid/dsh-xhs-collector | 0.82 | hit |
| xhs-video-watermark | positive | True | hzwym8912-code/dsh-everything-down | 0.72 | hit |
| bili-daily | positive | True | c1overzz/dsh-bili-scroll | 0.97 | hit |
| memory | positive | True | JunNanLYS/dsh-layered-memory | 0.95 | hit |
| lark-bot | positive | True | omdsh-dev/dsh-lark | 0.82 | hit |
| email | positive | True | STARDUSTLC666/dsh-email | 0.95 | hit |
| meeting-minutes | positive | True | scarf1985566475-cloud/dsh-voice | 0.82 | hit |
| tts | positive | True | 1624318455/dsh-plugin-tts | 0.85 | hit |
| voice-input | positive | True | chentao4183/dsh-voice-suite | 0.62 | hit |
| cron | positive | True | GooDAnDReaDY/dsh-cron | 0.82 | hit |
| paper-reader | positive | True | baigaobai/dsh-paper-harness | 0.85 | hit |
| chart | positive | True | lxfu1/dsh-plugin-chart | 0.78 | hit |
| sales-crm | positive | False | pqkisvery666/dsh-basic-office | 0.55 | missed (quiet) |
| subscriptions | positive | True | V1ki/dsh-plugin-subscriptions | 0.95 | hit |
| usage-cost | positive | True | Han-1413141/dsh-cost-meter | 0.85 | hit |
| pocket-remote | positive | True | zexadev/dsh-tether | 0.74 | hit |
| pptx | positive | True | dream-num/dsh-univer-office | 0.62 | hit |
| ocr | positive | True | Anionex/dsh-vision-toolkit | 0.95 | hit |
| emoji | positive | True | hellodigua/dsh-emoji | 0.97 | hit |
| pdf-translate | positive | True | MARIOMLY/dsh-pdf-translate | 0.82 | hit |
| chitchat | negative | False | — | 0.97 | correctly quiet |
| coding | negative | False | — | 0.95 | correctly quiet |
| concept | negative | False | — | 0.98 | correctly quiet |
| poem | negative | False | — | 0.95 | correctly quiet |
| debug | negative | False | — | 0.92 | correctly quiet |
| date | negative | False | — | 0.95 | correctly quiet |
| summarize-chat | negative | False | — | 0.95 | correctly quiet |
| math | negative | False | — | 0.98 | correctly quiet |
| naming | negative | False | — | 0.95 | correctly quiet |
| opinion | negative | False | — | 0.95 | correctly quiet |

The only remaining gap is `sales-crm`: the catalog has no dedicated CRM plugin, so the judge fell back to a generic office tool with confidence 0.55 and stayed quiet under the default threshold. `excel-formula` sits at 0.58 confidence and is also quiet by default; lower the minimum confidence to 0.5 if you want both covered.

