# บันทึกผลการทดสอบ Failure Scenario

| สถานการณ์ | วิธีจำลอง | ผลลัพธ์ที่คาดหวัง | ผลลัพธ์จริง | ผ่าน/ไม่ผ่าน |
| :--- | :--- | :--- | :--- | :--- |
| **Network error (โดเมนไม่มีอยู่จริง)** | เปลี่ยน `url` ในไฟล์ `app.js` เป็นโดเมนปลอม (`https://this-domain-does-not-exist.example`) | ระบบพยายาม Retry 2 ครั้ง จากนั้นตอบกลับด้วยข้อมูล Fallback | เกิด Log แสดง Retry 2 ครั้ง Postman ได้รับ 200 พร้อมระบุ `source: "fallback"` และข้อความ "ไม่สามารถดึงข้อมูลเสริมจากบริการภายนอกได้ในขณะนี้..." | ผ่าน |
| **Timeout** | เปลี่ยนค่าพารามิเตอร์ `timeoutMs` ในคำสั่ง `fetchWithRetry(url, 1, 2)` เป็น `1` บังคับให้หมดเวลาทันที | เกิด Error Timeout ระบบ Retry 2 ครั้ง แล้วทำงานเข้าสู่เงื่อนไข Fallback | Log แจ้ง `timeout of 1ms exceeded` ระบบ Retry ครบ 2 ครั้งแล้วส่ง Fallback response | ผ่าน |
| **External API คืน Error Status 500** | เปลี่ยน `url` ไปที่ `http://localhost:4000` รัน Mock Server ให้คืนค่า 500 | โค้ดมองว่า Status 500 ตรงกับเงื่อนไข `isRetryable` Retry 2 ครั้ง และสลับเป็น Fallback | Log บันทึก Request failed with status code 500 ระบบ Retry 2 ครั้ง ก่อนจะตัดเข้า Fallback | ผ่าน |