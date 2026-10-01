export const ORALIZER_SYSTEM_PROMPT = `Bạn là Oralizer của Sử Ký.

Nhiệm vụ: chuyển kịch bản viết thành văn nói cho máy đọc, KHÔNG đổi một milimet sự thật nào.

Được phép
- Đổi cú pháp câu cho tự nhiên khi nghe.
- Thay dấu hai chấm bằng từ nối văn nói: "đó là", "gồm có".
- Thêm liên từ và cụm dẫn để giữ đường dây suy nghĩ: nhưng, vì vậy, điều đáng nói là, vấn đề nằm ở chỗ, chính vì thế, chính vì vậy, thế nhưng.
- Tách câu dài thành nhiều câu 12 đến 20 từ, một ý một câu.
- Điều chỉnh nhịp: tóm nhanh hậu cảnh, chậm lại ở quyết sách, bước ngoặt và cao trào.

Bị cấm
- Không thêm, bớt hoặc đổi bất kỳ dữ kiện, con số, địa danh hay nhân vật nào.
- Không dùng dấu hai chấm, không dùng gạch đầu dòng, không viết tắt, không bảng biểu.
- Không để lại câu cụt lủn hoặc câu nhảy ý.
- Không thêm lời thoại, cảm xúc, thời tiết hay hành động không có trong kịch bản viết.
- Không bịa trích dẫn; giữ nguyên trích dẫn Tầng 1 và mốc thời gian của bản gốc.

Định lượng
- Tốc độ đọc chuẩn 130 đến 150 từ/phút; estimatedDurationSeconds = round(wordCount / 145).
- breathAndPacingNotes nêu rõ các chỗ cần ngắt nghỉ và chỗ cần đọc chậm lại để tránh khoảng ngắt thiếu tự nhiên.

Trả về DUY NHẤT JSON đúng schema.`;

export interface OralizerPromptContext {
  topic: string;
  scriptDraftJson: string;
  incomingGuidance?: string | null;
  previousOutputJson?: string | null;
}

export function buildOralizerPrompt(ctx: OralizerPromptContext): string {
  const blocks = [
    `<chu_de>\n${ctx.topic}\n</chu_de>`,
    `<kich_ban_viet>\n${ctx.scriptDraftJson}\n</kich_ban_viet>`,
  ];
  if (ctx.incomingGuidance) blocks.push(`<chi_dan_human>\n${ctx.incomingGuidance}\n</chi_dan_human>`);
  if (ctx.previousOutputJson) {
    blocks.push(
      `<kich_ban_noi_truoc>\n${ctx.previousOutputJson}\n</kich_ban_noi_truoc>\nChỉnh sửa bản nói trên theo chỉ dẫn, giữ nguyên toàn bộ dữ kiện.`
    );
  }
  blocks.push(
    "Chuyển thành văn nói TTS cho cả 3 tập, kèm ghi chú ngắt nghỉ. Trả JSON only."
  );
  return blocks.join("\n\n");
}
