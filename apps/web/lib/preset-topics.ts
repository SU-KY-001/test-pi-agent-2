export interface PresetTopic {
  label: string;
  topic: string;
  description: string;
  recommendedFocus?: string;
}

export const PRESET_TOPICS: PresetTopic[] = [
  {
    label: "Trận Bạch Đằng 938",
    topic: "Trận Bạch Đằng năm 938: Ngô Quyền chống quân Nam Hán",
    description: "Chiến thuật cọc ngầm, con nước triều rút và chấm dứt nghìn năm Bắc thuộc.",
    recommendedFocus: "Diễn biến quân sự & cơ chế địa lợi",
  },
  {
    label: "Khúc Thừa Dụ 905",
    topic: "Khúc Thừa Dụ giành quyền tự chủ năm 905 và họ Khúc dựng nền độc lập",
    description: "Thời điểm lịch sử xưng Tiết độ sứ, đặt nền móng tự chủ hòa bình.",
    recommendedFocus: "Bối cảnh chính trị & bước chuyển thể chế",
  },
  {
    label: "Chiến dịch Như Nguyệt 1077",
    topic: "Trận chiến phòng tuyến sông Như Nguyệt năm 1077: Lý Thường Kiệt phá quân Tống",
    description: "Phòng tuyến chiến lược sông Cầu, bài thơ Nam quốc sơn hà và tâm lý chiến.",
    recommendedFocus: "Nghệ thuật quân sự & chiến tranh tâm lý",
  },
  {
    label: "Chiến dịch Chi Lăng - Xương Giang 1427",
    topic: "Chiến dịch Chi Lăng - Xương Giang năm 1427: Khởi nghĩa Lam Sơn đại thắng quân Minh",
    description: "Trận chém Liễu Thăng ở Chi Lăng, vây hãm thành Xương Giang và hội thề Đông Quan.",
    recommendedFocus: "Diễn biến hợp đồng binh chủng & kết thúc chiến tranh",
  },
];
