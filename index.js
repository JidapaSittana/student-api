const pool = require("./db");

const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const morgan = require("morgan");

const app = express();
const PORT = process.env.PORT || 3000;
// const { graphqlHTTP } = require("express-graphql");
const schema = require("./schema");
const query = require("./resolvers");

//app.use(express.json());

// ลำดับ middleware มีความสำคัญ: security header → CORS → logger → body parser
// (ลำดับนี้ต่างจากแผนภาพตัวอย่างในหัวข้อ 1.2 ของ wk04.md ซึ่งวาง Logger ไว้ก่อน Helmet
// ทั้งสองลำดับใช้ได้ ตราบใดที่ Error-Handling Middleware ยังอยู่ท้ายสุดเสมอ)
app.use(helmet());
app.use(
  cors({
    origin: process.env.ALLOWED_ORIGIN,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
  })
);
app.use(morgan("dev"));
app.use(express.json({ limit: "10kb" }));

// ... route ทั้งหมดจากสัปดาห์ที่ 1-3 อยู่ต่อจากนี้ ...

// app.use(
//   "/graphql",
//   graphqlHTTP({
//     schema: schema,
//     rootValue: query,
//     graphiql: true, // เปิดใช้งานหน้าทดสอบ GraphiQL ผ่านเบราว์เซอร์
//   }),
// );

app.get("/", (req, res) => {
  res.status(200).json({ message: "Student API พร้อมใช้งาน" });
});

// let students = [
//   {
//     id: 1,
//     name: "สมชาย ใจดี",
//     major: "วิทยาการคอมพิวเตอร์",
//     email: "somchai@example.com",
//     phone: "080-000-0001",
//     courseIds: [101, 102],
//   },
//   {
//     id: 2,
//     name: "สมหญิง รักเรียน",
//     major: "เทคโนโลยีสารสนเทศ",
//     email: "somying@example.com",
//     phone: "080-000-0002",
//     courseIds: [102],
//   },
// ];

// let nextId = 3;

// let courses = [
//   { id: 101, courseName: "การเขียนโปรแกรมเบื้องต้น", credit: 3 },
//   { id: 102, courseName: "โครงสร้างข้อมูล", credit: 3 },
// ];

app.get("/api/v1/students", async (req, res, next) => {
  try {
    const [rows] = await pool.query("SELECT * FROM students");
    res.status(200).json({ message: "สำเร็จ", data: rows });
  } catch (err) {
    next(err);
  }
});

app.get("/api/v1/students/:id", async (req, res, next) => {
  try {
    const [rows] = await pool.query("SELECT * FROM students WHERE id = ?", [
      req.params.id,
    ]);

    if (rows.length === 0) {
      return res.status(404).json({
        error: { code: "NOT_FOUND", message: "ไม่พบข้อมูลนิสิต" },
      });
    }

    res.status(200).json({ message: "สำเร็จ", data: rows[0] });
  } catch (err) {
    next(err);
  }
});

app.post("/api/v1/students", async (req, res, next) => {
  const { name, major, email } = req.body;

  if (!name || !major || !email) {
    return res.status(400).json({
      error: { code: "VALIDATION_ERROR", message: "กรุณาระบุข้อมูลให้ครบถ้วน" },
    });
  }

  try {
    const [result] = await pool.query(
      "INSERT INTO students (name, major, email) VALUES (?, ?, ?)",
      [name, major, email],
    );
    res.status(201).json({
      message: "เพิ่มข้อมูลสำเร็จ",
      data: { id: result.insertId, name, major, email },
    });
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        error: { code: "DUPLICATE_EMAIL", message: "อีเมลนี้มีอยู่ในระบบแล้ว" },
      });
    }
    next(err);
  }
});

app.post("/api/v1/students/:id/enrollments", async (req, res, next) => {
  const studentId = req.params.id;
  const { courseId } = req.body;
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [courseRows] = await connection.query(
      "SELECT * FROM courses WHERE id = ? FOR UPDATE",
      [courseId],
    );

    if (courseRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        error: { code: "COURSE_NOT_FOUND", message: "ไม่พบรายวิชาที่ระบุ" },
      });
    }

    if (courseRows[0].seat_available <= 0) {
      await connection.rollback();
      return res.status(409).json({
        error: { code: "SEAT_FULL", message: "ที่นั่งเต็มแล้ว" },
      });
    }

    await connection.query(
      "INSERT INTO enrollments (student_id, course_id) VALUES (?, ?)",
      [studentId, courseId],
    );

    await connection.query(
      "UPDATE courses SET seat_available = seat_available - 1 WHERE id = ?",
      [courseId],
    );

    await connection.commit();
    res.status(201).json({ message: "ลงทะเบียนสำเร็จ" });
  } catch (err) {
    await connection.rollback();
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        error: {
          code: "ALREADY_ENROLLED",
          message: "นิสิตลงทะเบียนรายวิชานี้ไปแล้ว",
        },
      });
    }
    next(err);
  } finally {
    connection.release();
  }
});

app.listen(PORT, () => {
  console.log(`Server กำลังทำงานที่พอร์ต ${PORT} (${process.env.NODE_ENV})`);
});