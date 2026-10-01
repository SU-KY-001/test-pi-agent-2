# Sử Ký — Flow 2 Reference Rules (scout extraction)

READ-ONLY scout report. Sources (all under `E:/FPT/Semester_8/WDP301/su-ky-document/`):

| Ref | File |
|---|---|
| **A** | `outputs/series-bach-dang-938-v2-1.txt` (golden script, 3 episodes) |
| **B** | `outputs/bach-dang-938-foundation-data.txt` |
| **C** | `latex/260925035535-historical-storytelling-notes-v3.tex` |
| **D** | `latex/260925053336-bao-cao-nghien-cuu-flow-2-su-ky.tex` |
| **E** | `latex/261001021921-historical-storytelling-scripts.tex` ← **extra file, not in the 4-file list; contains most Text-for-Ear, Tier, Fact-Card and anti-pattern rules** |

Line refs are to those files. Quotes are verbatim (Vietnamese kept). `A`/`B`/`D`/`C` are the four listed files; `E` is an additional same-repo source.

---

## 1. Text-for-Ear rules

**Core philosophy** — `E:104` (box `E:100-106`):

> "Sức mạnh biểu cảm, sự kịch tính và nhịp điệu dồn dập phải được giải quyết triệt để ngay trên câu chữ, cấu trúc thông tin và dấu câu của kịch bản văn bản. Người nghe phải cảm nhận được sự lôi cuốn ngay cả khi nghe một giọng đọc máy tiêu chuẩn."

**Forbidden punctuation** — `E:314` (SOP Bước 4) and `E:483` (Trụ cột 4):

> "Cấm triệt để dấu hai chấm (`:`), gạch đầu dòng (`-`), từ viết tắt hoặc bảng biểu trong lời đọc của Narrator." (`E:314`)
> "Toàn bộ câu ngắn gọn (12--20 từ); không chứa dấu hai chấm, gạch đầu dòng; tốc độ đọc đạt 130--150 từ/phút." (`E:483`)

- **Colon (`:`)**: banned in narrator text. Convert to spoken connectors — `E:501`: "chuyển dấu hai chấm thành từ nối văn nói (`đó là`, `gồm có`)". Worked example `D:335-338`: written `"...một thứ mà ông có thể biến thành lợi thế: thủy triều."` → spoken `"...một thứ mà ông có thể biến thành lợi thế, đó là thủy triều."`
- **Hyphen / list dash (`-`)**: banned ("gạch đầu dòng"). Also no bullet lists read aloud (`E:314`, `E:483`). No tables in spoken text (`E:314`).
- **Abbreviations**: banned in narrator text (`E:314`).
- **Parentheses**: **NOT documented** in any of the read files (A–E). No explicit `(...)`/"ngoặc" rule exists to quote. Treat as absent.
- **Em-dash**: not explicitly banned; only the list-dash `-` is named.

**Sentence-length rule** — `E:313`: "Áp dụng nguyên tắc 'Một ý – Một câu' (12--20 từ/câu)." One idea = one sentence, 12–20 words. Heavy compound syntax (3–4 clause layers) is an anti-pattern (`E:501`, `E:935`).

**No-fragment / flow rule** — `D:323-325`: "Podcast được nghe theo thời gian nên người nghe không thể nhìn lại đoạn trên dễ như khi đọc. Vì vậy, mỗi câu cần nối tự nhiên với dòng suy nghĩ trước đó." `E:315`: "Câu sau sinh ra từ câu trước bằng các liên từ văn nói tự nhiên." (No standalone fragments; no jump-cut info.)

**Required connector vocabulary** — `D:325`: "Các liên từ và cụm dẫn như `nhưng`, `vì vậy`, `điều đáng nói là`, `vấn đề nằm ở chỗ`, `chính vì thế` có chức năng giữ đường dây suy nghĩ." `E:315`/`E:501` add `Nhưng`, `Chính vì vậy`, `Thế nhưng`; and colon-replacements `đó là`, `gồm có`.

**Pacing / breathing** — no literal "breathing" term; the rule is pacing co giãn + pause markers:
- `E:309` beat sheet: `00:00–00:25 (The Hook), Hồi 1 (Tình thế & Xung đột), Hồi 2 (Quyết sách & Kỹ nghệ bẫy cọc), Hồi 3 (Cao trào bùng nổ & Bước ngoặt sụp đổ), Vĩ thanh (Phản tư lịch sử & Trích dẫn chính sử)`.
- `E:320`: measure read speed on a TTS engine (Edge TTS) and "Điều chỉnh ... các đoạn ngắt câu thiếu tự nhiên"; standard 130–150 words/min.
- `E:406`: "TTS: Dùng câu đơn, ngắt nghỉ rõ ràng."
- `D:343-348` (Pacing phải co giãn): "Phần phụ có thể summary nhanh. Phần quyết định câu chuyện phải được chậm lại ... đoạn bước ngoặt và cao trào thường cần nhiều thời lượng hơn phần hậu cảnh."
- `A` golden script demonstrates short declaratives + comma pauses throughout.

`C:188`: "Dựng cảnh không đồng nghĩa với thêm mùi vị, lời thoại, cảm xúc hay hành động không có trong nguồn."

---

## 2. SPDC (Situation → Problem → Decision → Consequence)

**Definition** — `D:196-206` (box `D:202`), glossary `D:644`:

> `Situation → Problem → Decision → Consequence` (`D:202`)
> `[Situation--Problem--Decision--Consequence] Đơn vị kể vi mô dùng để nối logic giữa các sự kiện.` (`D:644`)

`D:199-206`: "Một story dài có thể được tạo bằng cách nối nhiều vòng như vậy." The Consequence of one loop becomes the *new Situation* of the next. Multi-arc pattern `D:227-231`: "Arc 1 → kết quả → tạo tình thế mới → Arc 2 → kết quả → Arc 3 → kết cục lớn." E's SOP Bước 3 (`E:309`) requires the beat sheet to run the SPDC chain; `E:482` (Trụ cột 3) requires "tuân thủ vòng lặp Situation → Problem → Decision → Consequence".

**Per-episode arc for the 3 episodes** (golden script A; E §7.2 `E:363-365`):

- **Tập 1 — "TỪ CUỘC NỘI LOẠN ĐẾN NGUY CƠ XÂM LƯỢC"** (`A:1`; E title *"Ngọn gió Ái Châu và đòn trừng phạt kẻ phản nghịch"*, `E:363`).
  - **S**ituation: 931 Dương Đình Nghệ wins autonomy; Ngô Quyền holds Ái Châu (`A:5`, `B:15,17`).
  - **P**roblem: 937 Kiều Công Tiễn assassinates Dương Đình Nghệ out of jealousy/fear (`A:7`, `B:16`).
  - **D**ecision: Kiều Công Tiễn (isolated) calls in Nam Hán; Ngô Quyền marches north and destroys him at Đại La (`A:9-15`).
  - **C**onsequence: internal threat gone, but Lưu Hoằng Tháo's fleet still incoming → cliffhanger; Ngô Quyền picks Bạch Đằng (`A:15-17`; `E:453`).
- **Tập 2 — "CÁI BẪY DƯỚI LÒNG SÔNG"** (`A:19`; E title *"Kế hiểm trên dòng sông rừng: Khi thủy triều là vũ khí"*, `E:364`).
  - **S**ituation: Nam Hán "lâu thuyền" (2–3 storey, thick hull) vs Vietnamese shallow-draft boats (`A:21`, `B:29`).
  - **P**roblem: cannot win a straight fight on open water.
  - **D**ecision: exploit the Bắc Bộ "nhật triều" (diurnal tide, 3–4 m) → lim/sến stakes, pointed, iron-sheathed, planted ~45° against the outgoing current (`A:23-27`, `B:25-33`).
  - **C**onsequence: trap hidden under the tide; bait force under Nguyễn Tất Tố ready → cliffhanger as the fleet appears in mist (`A:29-31`; `E:459`).
- **Tập 3 — "KHI NƯỚC BẮT ĐẦU RÚT"** (`A:37`; E title *"Máu đỏ cửa biển: Chấm dứt một ngàn năm bóng tối"*, `E:365`).
  - **S**ituation: tide at peak, fleet inside the estuary, stakes submerged (`A:39-41`).
  - **P**roblem: Lưu Hoằng Tháo arrogant, chasing the feigned retreat over the stake line (`A:41`).
  - **D**ecision: tide reverses; Ngô Quyền orders the general counter-attack from both banks (`A:43`).
  - **C**onsequence: ships impaled, fleet destroyed, Hoằng Tháo dies; Lưu Cung weeps and abandons the invasion; ends 1,000 years of Chinese rule (`A:45-49`; `E:465`).

Foundation narrative beats backing these (`B:37-43`): tide+bait+trap → arrogant chase → tide reverses → counter-attack → fleet impaled, Hoằng Tháo killed, Lưu Cung flees.

---

## 3. Source tier taxonomy (Tier 1..4) + cross-verification

**4-tier taxonomy** — `E:189-223` (fulltext), abstract `E:65`. Lead-in `E:189`: "Để đảm bảo tính xác thực học thuật và khả năng kiểm chứng theo quy định `BR-07`, hệ thống Sử Ký thiết lập Bảng phân cấp nguồn 4 tầng":

- **Tầng 1 — Chính sử & Văn khắc sơ cấp (Primary Chronicles)** — `E:192-199`. Đại Việt Sử Ký Toàn Thư (NXB KHXH 1993); Việt Sử Lược (NXB Thuận Hóa 2001); Khâm Định Việt Sử Thông Giám Cương Mục (NXB Giáo Dục 1998); châu bản/mộc bản triều Nguyễn, Đại Nam Thực Lục; cross-check Chinese records Tân Ngũ Đại Sử, Cựu Ngũ Đại Sử, Tư Trị Thông Giám, Tống Sử. Rule `E:198`: "Bắt buộc dùng để chứng minh các khẳng định lịch sử và gắn mốc trích dẫn `BR-07`."
- **Tầng 2 — Chứng cứ Khảo cổ học & Địa lý Lịch sử (Material Evidence)** — `E:201-207`: Yên Giang stake digs 1958/1988, Cao Quỳ 2019; C14 dating (Viện Khảo cổ học); hydrology of Bạch Đằng / Thái Bình rivers. Rule: material proof the tactic was feasible.
- **Tầng 3 — Công trình Nghiên cứu Sử học Hiện đại (Academic Secondary Sources)** — `E:209-214`: Trần Quốc Vượng, Hà Văn Tấn, Phan Huy Lê; *Tạp chí Nghiên cứu Lịch sử*. Rule: socio-economic/military context and deep interpretation.
- **Tầng 4 — Nguồn Khám phá & Huyền tích Dân gian (Folklore & Oral Traditions)** — `E:216-222`: thần tích, ngọc phả, local legends. Rule `E:220-221`: "Chỉ sử dụng để gợi mở góc nhìn và làm sinh động lời kể; không dùng làm bằng chứng xác thực độc lập."

B's research-citation block groups sources similarly (`B:47-71`): Vietnamese primary (`B:49-56`), Northern Chinese sources (`B:60-64`), archaeology (`B:67-68`), hydrology (`B:70-71`).

**Cross-verification method (multi-side)**
- `E:234-240` splits all info into 3 data tiers: **Hard Facts** (≥2 independent sources), **Historical Gaps**, **Folklore/Myths**.
- `E:238` Hard Facts rule: "Được ít nhất hai nguồn độc lập xác nhận (ĐVSKTT, Tân Ngũ Đại Sử, Khảo cổ học). Trong kịch bản, khẳng định chắc chắn và bắt buộc gắn mốc trích dẫn `BR-07`."
- Multi-side named "Đối chiếu đa phương" (`E:242`, `E:301`): Vietnamese chronicles (Tầng 1) cross-checked against **Chinese court records** — `E:242`: "Chính sử Trung Quốc (Đối chiếu đa phương): Tân Ngũ Đại Sử ... Tư Trị Thông Giám". Source set `E:229-247` cross-checks ĐVSKTT / Việt Sử Lược / Cương Mục against Tân Ngũ Đại Sử / Tư Trị Thông Giám + archaeology + hydrology.
- `D:368-374`: **discovery sources** (popular posts, forums, videos → only generate keywords/questions) vs **assertion sources** (books, academia, museums, universities, digitized sources, encyclopedias → support claims). `D:378`: "Một bài post có thể đưa hệ thống đến một chi tiết thú vị, nhưng trước khi đưa chi tiết đó vào narration, hệ thống phải tìm nguồn mạnh hơn để đối chiếu."
- `D:263-266` (Source Evaluator): ranks by reliability/type/relevance/era/author, and detects when "nhiều nguồn chỉ đang copy cùng một nội dung thay vì cung cấp xác nhận độc lập" (duplicates ≠ independent corroboration).

**Behavior when only one side / no source exists**
- Missing source detail = **Historical Gap** — `E:239`: "Những chi tiết cổ sử không ghi chép ... *Tuyệt đối không bịa đặt hội thoại giả tưởng.* Narrator sử dụng lời dẫn khách quan dựa trên logic thực địa hoặc thừa nhận khoảng trống sử liệu."
- `D:339-342`: "Nếu nguồn mâu thuẫn, bản kể phải cho người nghe biết có tranh luận thay vì ghép nhiều cách giải thích thành một sự thật chắc chắn. Nếu nguồn không đủ chi tiết để dựng một cảnh, có thể chuyển sang tóm lược hoặc nói thẳng về khoảng trống chứng cứ."
- Folklore (single-side) may be told only with an explicit attribution label — `E:240`: `"Trong ký ức dân gian vùng cửa sông..."`, `"Theo truyền thuyết địa phương..."`.
- Story Planner must return a **research gap** rather than guess — `D:477-478`.

---

## 4. Fact Card / Research Pack fields, confidence, timeline, entities, gaps

**Fact Card minimal fields** — `D:396-407`:

> "Đơn vị dữ liệu quan trọng có thể là Fact Card. Một Fact Card tối thiểu gồm:"
> - claim hoặc sự kiện (`D:398`)
> - thời gian và địa điểm nếu có (`D:399`)
> - nhân vật liên quan (`D:400`)
> - nguồn hỗ trợ (`D:401`)
> - đoạn trích hoặc vị trí trong nguồn (`D:403`)
> - **mức độ tin cậy** (`D:404`)
> - **tình trạng: xác nhận, tranh luận, chưa đủ bằng chứng** (`D:405`)
> - quan hệ tiềm năng với các fact khác (`D:406`)
> - **narrative relevance: fact này giúp trả lời câu hỏi nào** (`D:407`)

`E:301` adds: identifiers, claim, original-text citation, "đối chiếu đa phương"; `D:516`/`D:575` name the eventual schema `Fact Card, Entity, Event, Citation, Causal Claim and Research Gap`.

**Research Pack** — `D:410-414`:
- `D:410`: "Không đưa document thô thẳng vào Script Writer" — raw PDFs/URLs are not the research output; they become a structured **Research Pack**.
- `D:414`: "Research Pack cần thêm lớp semantic: facts, entities, timeline, causal claims, disagreements và citation. ... RAG là một cơ chế retrieval; Research Pack mới là dạng dữ liệu mà Story Planner cần."
- Story Planner works mainly on the Research Pack while original docs are kept for citation trace (`D:412`); `D:584` lists pack contents: "Fact Cards, Timeline, Causal Claims".
- Unresolved: schema not finalized — `D:575`: "Cần chốt chính xác cấu trúc Fact Card, Entity, Event, Citation, Causal Claim và Research Gap."

**Confidence levels**: two orthogonal signals — `mức độ tin cậy` (`D:404`) and status enum `xác nhận | tranh luận | chưa đủ bằng chứng` (`D:405`). E's 3-tier data model expresses the same as Hard Facts (≥2 independent sources), Historical Gaps, Folklore/Myths (`E:234-240`).

**Timeline / entities / gaps**: explicit Research Pack layers (timeline + entities, `D:414`, `D:584`, `D:597`); **Research Gap** glossary `D:648`: "Thông tin mà story cần nhưng corpus hiện chưa đủ căn cứ để khẳng định." `D:477-478`: Story Planner returns a research gap instead of guessing. Cross-source disagreement must be preserved, not flattened (`D:339-342`, `D:414` "disagreements").

**Example card semantics** — `D:416-418`: facts like "Quang Trung mất năm 1792" and "Nguyễn Quang Toản kế vị khi còn nhỏ"; a *relation* card may describe the power-distribution change — but "quan hệ nhân quả chỉ được ghi như claim khi có đủ nguồn support."

---

## 5. Narrative focus categories, titles, length/duration, third-person voice

**Two co-existing classifications in the repo:**

**(a) 3 templates (Flow 2 report D §5, `D:213-306`)** — chosen by *narrative focus*, not by title form (`D:120-124`):
- **Template A: Diễn biến** — central Q "Sự kiện này diễn ra như thế nào?" 10-step arc `D:294-306`.
- **Template B: Nhân vật** — "Nhân vật này đã làm gì, muốn đạt điều gì và để lại điều gì?" 8-step arc `D:307-317`; needs a strong central question to avoid becoming a list of achievements.
- **Template C: Nguyên nhân** — "Vì sao kết quả X xảy ra?" 9-step arc `D:318-330`; must not collapse multi-cause events into one cause (`D:330`).
- Scale wrapper (not a 4th template) `D:289-303`: **Single-arc** (a battle/decision/compact event) vs **Multi-arc** (long war, dynasty, era). "Quá trình" is treated mainly as *scale*, not its own template (`D:236-238`); "Giải quyết vấn đề" is a *micro-mechanism*, not a separate template (`D:335-341`).
- Templates derived from 4 model videos (`D:245-259`); one dã-sử Bạch Đằng 938 video deliberately excluded (`D:260-265`).

**(b) 5 narrative angles for Bạch Đằng 938 (E §4.2, `E:259-263`)**:
1. Angle 1 — Chiến thuật & Địa lý Thủy văn (Tactical & Hydro-geography) `E:259`.
2. Angle 2 — Đấu trí Lãnh đạo & Quyết sách (Leadership Decision-Making) `E:260`.
3. Angle 3 — Địa chính trị Phương Bắc & Bẫy Nam Hán `E:261`.
4. Angle 4 — Đời sống Dân binh & Kỹ nghệ dựng bãi cọc `E:262`.
5. Angle 5 — Bước ngoặt Thời đại & Chấm dứt Bắc thuộc `E:263`.

**Example series / episode titles** (`E:278-286`, title table §4.3; formula in E:276 `Tiêu đề = [Yếu tố Định vị/Câu hỏi Then chốt] + [Tên Sự kiện/Nhân vật] + ([Góc nhìn Đặc thù])`):
- Angle 1: *"Thủy triều Bạch Đằng 938: Chiếc bẫy con nước và ngàn cọc gỗ bịt sắt"* (`E:278`).
- Angle 2: *"Nước cờ Ngô Quyền 938: Đòn trừng phạt chớp nhoáng và thuật nắm thời cơ"* (`E:280`).
- Angle 3: *"Ảo mộng Nam Hán: Vì sao hạm đội Lưu Hoằng Tháo chìm nghỉm ở Bạch Đằng?"* (`E:282`).
- Angle 4: *"Mồ hôi và gỗ lim: Dân binh dựng bãi cọc Bạch Đằng giữa mùa đông giá rét"* (`E:284`).
- Angle 5: *"Bạch Đằng 938: Nhát kiếm chặt đứt một ngàn năm Bắc thuộc"* (`E:286`).
- Bad-title column bans clickbait ("Tiêu đề Giật gân rẻ tiền (Cấm dùng)", `E:279,281,283,285`).
- 3-episode series titles (`E:363-365`; golden `A:1,19,37`): Tập 1 "Ngọn gió Ái Châu và đòn trừng phạt kẻ phản nghịch" / golden "TỪ CUỘC NỘI LOẠN ĐẾN NGUY CƠ XÂM LƯỢC"; Tập 2 "Kế hiểm trên dòng sông rừng: Khi thủy triều là vũ khí" / golden "CÁI BẪY DƯỚI LÒNG SÔNG"; Tập 3 "Máu đỏ cửa biển: Chấm dứt một ngàn năm bóng tối" / golden "KHI NƯỚC BẮT ĐẦU RÚT".

**Target word count + estimated duration** (multiple, slightly inconsistent — cite each):
- Single episode: 5–8 phút, **800–1.200 từ** (`E:353`); checklist "Tổng thời lượng đạt 6 phút 45 giây (thỏa mãn chuẩn đơn tập 5-8 phút)" (`E:919`).
- Worked single-episode script: **1.050 từ, ~6 phút 45 giây** (`E:379`); BR-07 citation timestamp at second 360 = 06:00 (`E:381`, `E:430`).
- Related markdown variant quotes 5–10 phút / 800–1.400 từ (`outputs/historical-storytelling-scripts.md`).
- 5 angles each optimized to 5–12 phút, one central question per episode (`E:252`).
- Multi-episode series: **3–5 tập**, cliffhanger between episodes (`E:354`).
- Foundation data (project constraint): **3 tập (10–11 phút/tập)**, "Thuyết Khoảng trống Thông tin", strictly evidence-bound (`B:12`).
- Read-speed standard: **130–150 từ/phút** (`E:320`, `E:483`).
- Lanszki (2022): keep 15–20% of closing time for reflection (`E:693`).

**Third-person voice constraints (no invented dialogue / weather / emotions)**:
- Narrator fixed: "Người kể ngôi thứ ba, đứng ngoài lịch sử, có góc nhìn bao quát nhưng bị giới hạn bởi sử liệu." (`D:148`); his knowledge must not exceed the sources; locked in v1 to reduce complexity (`D:150`).
- `C:77`: "Chi tiết về lời nói, cảm giác, thời tiết, vị trí hay hành động cụ thể của người trong cuộc không được đưa vào kịch bản như sự thật khi chưa có căn cứ."
- `C:188`: "Dựng cảnh không đồng nghĩa với thêm mùi vị, lời thoại, cảm xúc hay hành động không có trong nguồn."
- `C:154-159`: story arc / turning point / climax / resolution are analytic labels and must not be conflated.
- `D:139-141`: "Người kể không được tự biết suy nghĩ, cảm xúc hoặc lời nói riêng của nhân vật nếu nguồn không hỗ trợ. Cách này tránh việc AI biến podcast lịch sử thành dã sử hoặc tiểu thuyết hóa quá mức."
- `E:239`: no invented private dialogue; use objective narrator framing or admit the gap — worked example: instead of `"Hoằng Tháo run sợ van xin..."`, write `"Sử sách không ghi lại lời trăng trối của Hoằng Tháo, nhưng trước mắt vị tướng trẻ Nam Hán chỉ còn là cảnh đoàn chiến thuyền tan vỡ giữa dòng nước xiết."`
- `E:453/459` allow cliffhanger *structure* built only from sourced facts (fleet departure, sails on horizon).
- §8.1 Trụ cột 1 (`E:480`): "Mọi fact chính đều truy nguyên được về Fact Cards (Chính sử Tầng 1). Không bịa đặt lời thoại riêng tư của nhân vật."

---

## 6. Anti-pattern list from golden script revision (what was removed)

Diff of `series-bach-dang-938-v2.txt` (v2, 3.738 words) → `series-bach-dang-938-v2-1.txt` (golden, 2.248 words) — **~40% cut**. Removed in v2-1:

1. **Sensational rhetorical hook** — v2 opened `"Bạn có bao giờ tự hỏi, một ngàn năm đen tối ... thực sự kết thúc như thế nào không?"` + `"Sách giáo khoa thường chỉ tóm gọn trong vài dòng ngắn ngủi: ..."` → replaced by calm `"Chào các bạn. Nếu nhắc đến trận Bạch Đằng năm 938 ..."` (`A:3`). Note the colon in the removed line.
2. **Invented weather / atmosphere** — v2 `"trở về một buổi tối mùa thu năm 937 tại thành Đại La. Trời mưa tầm tã. Đó không phải là một cơn mưa bình thường..."` → removed (no sourced weather).
3. **Invented night-ambush scene** — v2 `"trong cái đêm mưa gió mịt mù ấy, Kiều Công Tiễn đã ... xua quân tâm phúc đánh úp tư dinh, sát hại chính người cha nuôi..."` → removed.
4. **Invented hagiographic appearance** — v2 quoted `"mắt sáng như chớp, bước đi đĩnh đạc tựa cọp gầm"`, age `"bốn mươi mốt tuổi"`, and a calm-under-rage scene (`"Ngô Quyền giữ một sự điềm tĩnh đáng sợ. Ông triệu tập các tướng lĩnh và nói rõ cục diện..."`) → all removed. (Foundation data `B:8` explicitly forbids the "mắt chớp, dáng cọp" register: "KHÔNG dùng ... từ ngữ sáo rỗng ước lệ (như 'mắt chớp, dáng cọp')".)
5. **Invented fisherman-interview scene** — v2 `"Nhiều ngày liền, người ta thấy vị chủ tướng bốn mươi mốt tuổi ấy cứ đứng lặng bên mép sóng ... lân la trò chuyện với những ngư dân bản địa ..."` → removed.
6. **Proverbs / decorative idioms** — v2 `"nuôi ong tay áo, nuôi cáo trong nhà"`, the 3.000-adopted-sons detail, `"quyền lực đẫm máu"`, `"cái lồng giam lỏng"` → removed.
7. **Direct audience cross-examination** — v2 `"Bạn thử hình dung xem, một kẻ giết cha đoạt vị, thì ai mà phục?"`, `"Bạn hiểu ý nghĩa của việc này chứ?"` → removed (kept only neutral `"Chào các bạn"` / `"chúng ta"`).
8. **Colon exposition in spoken text** — v2 `"...nhận ra một sự thật cay đắng: Hắn hoàn toàn đơn độc."` → removed/rephrased into separate sentences (Text-for-Ear colon ban, §1).
9. **Dramatized pacing / emotional color** (`"đáng sợ"`, `"sự thật cay đắng"`, `"lòng tham vô đáy"`) → replaced with factual causal narration ("Kiều Công Tiễn sợ rằng quyền lực sớm muộn gì cũng sẽ rơi vào tay ... Ngô Quyền", `A:7`).

E §8.2 (`E:496-503`) codifies the same 3 named anti-patterns:
- **Textbook listing** ("Kịch bản 'đọc sách giáo khoa'": liệt kê mốc thời gian liên tục) → fix: rebuild as `Situation → Problem → Decision → Consequence`; add artifact/detail anchors.
- **Invented historical dialogue** ("Bịa đặt lời thoại dã sử") → fix: convert to objective narrator framing; admit the Historical Gap.
- **Heavy written syntax** ("Cú pháp văn viết nặng nề": 3–4-clause compounds, colons, enumerated lists) → fix: 12–20-word single-clause sentences; replace colons with `đó là`, `gồm có`.
- Plus `E:503` "Thiếu trích dẫn BR-07" → CMS blocks publication; must embed ≥1 verbatim primary-source citation with a second timestamp.

---

## PROMPT-READY RULES (compact, per role)

**Researcher**
- Start from the chosen topic + narrative focus; generate specific research questions, not broad keywords (`D:381-388`).
- Respect the selected template (diễn biến / nhân vật / nguyên nhân) and scale (single-arc / multi-arc).
- Prefer Tier 1–2 sources (chính sử, văn khắc, khảo cổ, hydrology) then Tier 3; Tier 4 only for discovery, never as evidence (`E:189-223`).
- User PDF/URL is one source in a wider corpus, not the whole corpus (`D:355-366`).
- Tag each source role: discovery vs assertion (`D:368-378`).

**Source Evaluator**
- Rank by reliability, source type, relevance, era, author, claim-supporting ability (`D:263`).
- Detect duplicate copies masquerading as independent corroboration (`D:263-265`).
- Hard Fact requires ≥2 independent sources (e.g. ĐVSKTT + Tân Ngũ Đại Sử + archaeology) (`E:238`).
- If sources conflict, keep the disagreement visible, never flatten it (`D:339-342`).
- If only one side / no source: mark Historical Gap; Tier-4 folklore only with an explicit attribution label (`E:239-240`).

**Fact Extractor**
- Output structured Fact Cards, not prose (`D:392-420`).
- Fields: claim/event; time+place; persons; supporting source; excerpt/position; confidence; status {xác nhận | tranh luận | chưa đủ bằng chứng}; potential relations; narrative relevance (`D:396-407`).
- Keep citation trace to the original document (`D:412`).
- Record causal relations as *claims* only with sufficient source support (`D:418`).
- Build semantic layers: facts, entities, timeline, causal claims, disagreements, citation (`D:414`).

**Story Planner**
- Work on the Research Pack; choose one narrative focus (diễn biến / nhân vật / nguyên nhân) and a scale (`D:463-478`).
- Find: opening situation, central question, SPDC loops, turning point, causal chains (nguyên nhân) or theme groups (nhân vật), single/multi-arc boundary, missing facts (`D:466-476`).
- Assemble via `Situation → Problem → Decision → Consequence`; each Consequence seeds the next Situation (`D:196-206`).
- Never fill a research gap by guessing — return a Research Gap (`D:477-478`).
- Multi-arc: `Arc 1 → result → new situation → Arc 2 → ... → final outcome`; each arc keeps its own SPDC loop (`D:227-231`).

**Script Writer**
- Only start from a stable Story Outline; add NO new facts outside the Research Pack (`D:480-483`).
- Third-person narrator standing outside history, bounded by the sources (`D:148`).
- Never invent dialogue, thoughts, feelings, weather, position or specific actions; use objective narration or state the gap (`C:77`, `C:188`, `E:239`, `E:480`).
- Keep the chosen focus/angle to 100% (`E:919`).
- Order: Hook in first 25 s; Hồi 1 tình thế & xung đột; Hồi 2 quyết sách; Hồi 3 cao trào/bước ngoặt; Vĩ thanh reflection + primary-source citation (`E:309`, `E:482`).

**Oralizer**
- One idea = one sentence, 12–20 words (`E:313`).
- Ban colon (`:`) and list dash (`-`) in narrator text; no abbreviations, no tables; convert colon to `đó là` / `gồm có` (`E:314`, `E:501`).
- Every sentence must arise from the previous one via spoken connectors: `nhưng`, `vì vậy`, `điều đáng nói là`, `vấn đề nằm ở chỗ`, `chính vì thế`, `Chính vì vậy`, `Thế nhưng` (`D:325`, `E:315`).
- Vary pacing: summarize background fast; slow down at decisions, turning point and climax (`D:343-348`).
- Measure TTS read speed: 130–150 words/min; fix awkward pauses (`E:320`).
- Must NOT change factual meaning (`D:490`). *(Parentheses are not documented as banned — do not assert a rule that isn't in the sources.)*

**Fact Checker**
- Split the script into atomic factual claims; verify each has evidence (`D:492-495`).
- Unsupported claim → delete / rewrite / send back to the Researcher (`D:495`).
- Enforce `BR-07`: ≥1 valid Tier-1 citation with an exact `audio_timestamp_seconds` (`E:120`, `E:481`).
- Confirm no invented private dialogue; confirm folklore is labeled; enforce the pre-1945 scope `BR-08` (`E:480`).
- This is the main barrier against "LLM inventing to smooth the story" (`D:495`).

---

*Report written read-only; no repository source files were modified. Only this file was created.*
