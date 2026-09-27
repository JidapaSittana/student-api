// app.test.js
const request = require("supertest");

jest.mock("./cache", () => ({
  redisClient: {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue("OK"),
    del: jest.fn().mockResolvedValue(1),
    on: jest.fn(),
    connect: jest.fn().mockResolvedValue(),
  },
  connectRedis: jest.fn().mockResolvedValue(),
}));

jest.mock("./db");

const app = require("./app");
const pool = require("./db");

describe("App.js Integration Tests", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.JWT_SECRET = "test_secret";
  });

  test("GET / ควรคืนสถานะ 200", async () => {
    const res = await request(app).get("/");
    expect(res.status).toBe(200);
  });

  // ทดสอบ GET /api/v1/students
  describe("GET /api/v1/students", () => {
    test("ควรคืน 200 พร้อมข้อมูลเมื่อระบุ major", async () => {
      // Mock ให้ query คืนค่าข้อมูลนิสิต และ total สำหรับ pagination
      pool.query
        .mockResolvedValueOnce([[{ id: 1, major: "CS" }]])
        .mockResolvedValueOnce([[{ total: 1 }]]);

      const res = await request(app).get("/api/v1/students?major=CS");
      expect(res.status).toBe(200);
    });
  });

  // ทดสอบ GET /api/v1/students/:id
  describe("GET /api/v1/students/:id", () => {
    test("ควรคืน 404 เมื่อไม่พบข้อมูลนิสิต", async () => {
      pool.query.mockResolvedValueOnce([[]]);
      const res = await request(app).get("/api/v1/students/999");
      expect(res.status).toBe(404);
    });

    test("ควรคืน 200 เมื่อพบข้อมูลนิสิต", async () => {
      pool.query.mockResolvedValueOnce([[{ id: 1, name: "John" }]]);
      const res = await request(app).get("/api/v1/students/1");
      expect(res.status).toBe(200);
    });
  });

  describe("POST /api/v1/students", () => {
    test("ควรคืน 400 เมื่อข้อมูลไม่ครบ", async () => {
      const res = await request(app)
        .post("/api/v1/students")
        .send({ name: "John" });
      expect(res.status).toBe(400);
    });

    test("ควรคืน 201 เมื่อเพิ่มนิสิตสำเร็จ", async () => {
      pool.query.mockResolvedValueOnce([{ insertId: 10 }, undefined]);

      const res = await request(app)
        .post("/api/v1/students")
        .send({ name: "John", major: "CS", email: "john@test.com" });

      expect(res.status).toBe(201);
    });

    test("ควรคืน 409 เมื่ออีเมลซ้ำ", async () => {
      const dbError = new Error("Duplicate entry");
      dbError.code = "ER_DUP_ENTRY";
      pool.query.mockRejectedValueOnce(dbError);

      const res = await request(app)
        .post("/api/v1/students")
        .send({ name: "John", major: "CS", email: "dup@test.com" });

      expect(res.status).toBe(409);
    });
  });

  describe("POST /api/v1/students/:id/enrollments", () => {
    let mockConn;

    beforeEach(() => {
      mockConn = {
        beginTransaction: jest.fn().mockResolvedValue(),
        query: jest.fn(),
        commit: jest.fn().mockResolvedValue(),
        rollback: jest.fn().mockResolvedValue(),
        release: jest.fn(),
      };
      pool.getConnection.mockResolvedValue(mockConn);
    });

    test("ควรคืน 400 เมื่อไม่ระบุ courseId", async () => {
      const res = await request(app)
        .post("/api/v1/students/1/enrollments")
        .send({});

      expect(res.status).toBe(400);
    });

    test("ควรคืน 404 เมื่อไม่พบวิชาเรียน", async () => {
      mockConn.query.mockResolvedValueOnce([[]]);

      const res = await request(app)
        .post("/api/v1/students/1/enrollments")
        .send({ courseId: 999 });

      expect(res.status).toBe(404);
    });

    test("ควรคืน 409 เมื่อที่นั่งเต็ม", async () => {
      // จำลองให้ค้นพบวิชาเรียน แต่ที่นั่งเป็น 0
      mockConn.query.mockResolvedValueOnce([[{ id: 1, seat_available: 0 }]]);

      const res = await request(app)
        .post("/api/v1/students/1/enrollments")
        .send({ courseId: 1 });

      expect(res.status).toBe(409);
    });

    test("ควรคืน 409 เมื่อลงทะเบียนซ้ำ", async () => {
      // 1. ค้นพบวิชาและที่นั่งว่าง
      mockConn.query.mockResolvedValueOnce([[{ id: 1, seat_available: 10 }]]);

      // 2. จำลองให้ตอน Insert เกิด Error ข้อมูลซ้ำ
      const dbError = new Error("Duplicate entry");
      dbError.code = "ER_DUP_ENTRY";
      mockConn.query.mockRejectedValueOnce(dbError);

      const res = await request(app)
        .post("/api/v1/students/1/enrollments")
        .send({ courseId: 1 });

      expect(res.status).toBe(409);
    });
  });
});
