import React, { useState, useEffect } from 'react';
import axios from 'axios'; // Đảm bảo đã cài axios

function App() {
  const [freeSlots, setFreeSlots] = useState([]);
  const [loading, setLoading] = useState(false);

  // Hàm gọi API xếp lịch từ Python Microservice [cite: 190]
  const handleFindSchedule = async () => {
    setLoading(true);
    try {
      const response = await axios.post('http://localhost:8000/api/schedule/find-free-slots', {
        usernames: ["Nguyễn Ngọc Tôn", "Nguyễn Võ Minh Anh"], // Lấy từ danh sách thành viên [cite: 301]
        duration_minutes: 60,
        search_start: "2026-04-05T08:00:00",
        search_end: "2026-04-05T18:00:00"
      });
      setFreeSlots(response.data.suggested_slots);
    } catch (error) {
      console.error("Lỗi khi tìm lịch:", error);
    }
    setLoading(false);
  };

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6 text-blue-700">Lên lịch họp thông minh 📅</h1>
      
      <button 
        onClick={handleFindSchedule}
        disabled={loading}
        className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-all mb-8 shadow-md"
      >
        {loading ? "Đang tính toán..." : "Tìm khung giờ rảnh chung"}
      </button>

      {freeSlots.length > 0 && (
        <div className="bg-white border rounded-xl overflow-hidden shadow-sm">
          <div className="bg-gray-50 px-4 py-2 border-b font-semibold text-gray-700">
            Các khung giờ đề xuất [cite: 301]
          </div>
          <div className="divide-y">
            {freeSlots.map((slot, index) => (
              <div key={index} className="p-4 flex justify-between items-center hover:bg-blue-50">
                <div>
                  <p className="text-sm text-gray-500 font-medium">Bắt đầu: {new Date(slot.start).toLocaleString('vi-VN')}</p>
                  <p className="text-sm text-gray-500 font-medium">Kết thúc: {new Date(slot.end).toLocaleString('vi-VN')}</p>
                </div>
                <button className="bg-green-500 text-white px-3 py-1 rounded text-sm hover:bg-green-600">
                  Chọn giờ này
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default App;