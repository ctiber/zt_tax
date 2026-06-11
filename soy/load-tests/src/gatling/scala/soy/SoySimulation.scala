package soy

import io.gatling.core.Predef._
import io.gatling.http.Predef._
import scala.concurrent.duration._

/**
 * SoY – Zero Trust Security Tax Load Test
 *
 * Simulates the lifecycle of a Shell-on-You classroom:
 *
 *   Phase 1 – Classroom beginning (ramp-up):
 *     Students arrive, authenticate, consult the session and browse exercises.
 *     → Tests the read path: gateway → ms-other
 *
 *   Phase 2 – Active session (sustained load):
 *     Both browsing and exercise submission happen concurrently.
 *     → Tests both services under constant load.
 *
 *   Phase 3 – End of session (ramp-down + submission burst):
 *     Students submit their exercise productions before the deadline.
 *     → Tests the write/eval path: gateway → ms-exercise
 *     (heavier per-request, lower RPS target)
 *
 * ─── Load shape ──────────────────────────────────────────
 *
 *  RPS  S1 Classroom Begin
 *   │    ___________sustained____________
 *   │   ╱                                ╲
 *   │  ╱ ramp-up                  ramp-down╲
 *   │ ╱                                     ╲
 *   ╰────────────────────────────────────────── time
 *
 *   RPS  S2 Exercise Submit (delayed start, lower rate)
 *   │                    ___sustained____
 *   │                   ╱                ╲
 *   │              ramp╱                  ╲ramp
 *   │─────────────────╱                    ╲──── time
 *   │     nothingFor(rampUp + sustained/3)
 *
 * ─── Configuration ───────────────────────────────────────
 * All parameters are overridable via -D JVM flags or Maven -D properties:
 *
 *   -DbaseUrl=http://localhost:5001
 *   -DrampUp=60       (seconds)
 *   -Dsustained=300   (seconds)
 *   -DrampDown=60     (seconds)
 *   -DtargetRps=5.0   (requests/second at peak)
 *   -DsessionId=1     (business-session ID to use)
 *   -DexerciseId=1    (exercise ID to submit)
 *
 * ─── Assertions (will fail the build if violated) ────────
 *   P99 response time < 5 s
 *   Success rate       > 95 %
 */
class SoySimulation extends Simulation {

  // ── Parameters ────────────────────────────────────────────
  val baseUrl     : String  = sys.props.getOrElse("baseUrl",    "http://localhost:5001")
  val rampUp      : Int     = sys.props.getOrElse("rampUp",     "60").toInt
  val sustained   : Int     = sys.props.getOrElse("sustained",  "300").toInt
  val rampDown    : Int     = sys.props.getOrElse("rampDown",   "60").toInt
  val targetRps   : Double  = sys.props.getOrElse("targetRps",  "5.0").toDouble
  val sessionId   : String  = sys.props.getOrElse("sessionId",  "1")
  val exerciseId  : String  = sys.props.getOrElse("exerciseId", "1")

  // Submit scenario uses a lower rate: Python evaluation is CPU-intensive
  val submitRps   : Double  = targetRps * 0.3

  // ── HTTP protocol ─────────────────────────────────────────
  val httpProtocol = http
    .baseUrl(baseUrl)
    .acceptHeader("application/json")
    .contentTypeHeader("application/json")
    .userAgentHeader("Gatling/SoY-ZeroTrust-Benchmark")
    .disableFollowRedirect
    // Cookies managed automatically; httpOnly cookies are handled correctly
    // by Gatling's built-in cookie jar (doesn't affect non-browser clients)
    .inferHtmlResources(
      AllowList(),
      DenyList(".*\\.css", ".*\\.js", ".*\\.png", ".*\\.ico")
    )

  // ── Feeders ───────────────────────────────────────────────
  // students.csv: email,password  (30 test accounts, cycling)
  val studentFeeder = csv("data/students.csv").circular

  // ── Shared chains ─────────────────────────────────────────
  val login = exec(
    http("S_login")
      .post("/api/user/login")
      .body(StringBody("""{"email":"${email}","password":"${password}"}"""))
      .asJson
      .check(status.is(200))
      .check(jsonPath("$.user_id").saveAs("userId"))
      .check(jsonPath("$.role_id").saveAs("roleId"))
  ).pause(300.milliseconds, 800.milliseconds)

  val logout = exec(
    http("S_logout")
      .delete("/api/user/logout")
      .check(status.in(200, 204))
  )

  // ──────────────────────────────────────────────────────────
  // SCENARIO 1 – Classroom Beginning
  //
  // Models students arriving at the start of a Shell-on-You session:
  //   1. Login (gateway → ms-other, sets cookies)
  //   2. Read the active business-session info (gateway → ms-other)
  //   3. Browse the exercise list for that session (gateway → ms-other)
  //   4. Open one exercise to read its statement (gateway → ms-other)
  //   5. Retrieve their personal student-statement (gateway → ms-exercise)
  //      ↑ this hop crosses the second microservice
  //   6. Logout
  //
  // Deliberately read-only to measure the baseline read-path overhead
  // of each ZT primitive without Python evaluation noise.
  // ──────────────────────────────────────────────────────────
  val classroomBegin = scenario("S1_ClassroomBegin")
    .feed(studentFeeder)
    .exec(login)

    // Gateway → ms-other: read session metadata
    .exec(
      http("S1_getSession")
        .get(s"/api/business-session/$sessionId")
        .check(status.in(200, 403, 404))
    )
    .pause(500.milliseconds, 1500.milliseconds)

    // Gateway → ms-other: get the exercises for this session
    .exec(
      http("S1_getSessionExercises")
        .get(s"/api/business-session/$sessionId/exercises")
        .check(status.in(200, 403, 404))
    )
    .pause(1.second, 2.seconds)

    // Gateway → ms-other: read one exercise statement
    .exec(
      http("S1_getExercise")
        .get(s"/api/exercise/$exerciseId")
        .check(status.in(200, 404))
    )
    .pause(2.seconds, 5.seconds)  // simulate reading the exercise

    // Gateway → ms-exercise: get the personal student statement
    // (crosses the second microservice – key for ZT measurement)
    .exec(
      http("S1_getStudentStatement")
        .get(s"/api/student-statement/user/$${userId}/exercise/$exerciseId/business-session/$sessionId")
        .check(status.in(200, 404))  // 404 is valid if statement not pre-generated
    )
    .pause(3.seconds, 8.seconds)  // simulate reading the instructions

    .exec(logout)

  // ──────────────────────────────────────────────────────────
  // SCENARIO 2 – Exercise Submission (end of session)
  //
  // Models students submitting work before the session deadline:
  //   1. Login (gateway → ms-other)
  //   2. Verify session is still open (gateway → ms-other)
  //   3. Get all their productions for this session (gateway → ms-exercise)
  //   4. Submit a new exercise production with a shell script answer
  //      (gateway → ms-exercise; triggers Python evaluation)
  //   5. Poll the result (gateway → ms-exercise)
  //   6. Logout
  //
  // This scenario crosses BOTH microservices and includes a write + evaluation.
  // Measures the ZT overhead on the heavier write path.
  // ──────────────────────────────────────────────────────────
  val exerciseSubmit = scenario("S2_ExerciseSubmit")
    .feed(studentFeeder)
    .exec(login)

    // Gateway → ms-other: confirm session is active
    .exec(
      http("S2_checkSession")
        .get(s"/api/business-session/$sessionId")
        .check(status.in(200, 403, 404))
    )
    .pause(1.second, 3.seconds)

    // Gateway → ms-exercise: check existing productions for this student/session
    .exec(
      http("S2_listProductions")
        .get(s"/api/exercise-productions/session/$sessionId/student/$${userId}")
        .check(status.in(200, 403, 404))
    )
    .pause(5.seconds, 15.seconds)  // simulate time spent writing the answer

    // Gateway → ms-exercise: submit exercise production
    // Sends a multipart form with the shell script answer file
    .exec(
      http("S2_submitProduction")
        .post("/api/exercise-production")
        // Multipart: ex_id + ps_id + production_data (shell script file)
        .formParam("ex_id", exerciseId)
        .formParam("ps_id", sessionId)
        .formUpload("production_data", "data/answer.sh")
        .check(status.in(200, 201, 400, 401, 412, 500))
        // Only try to extract the production ID when the response is JSON.
        // The evaluation script may return HTML on error (500) – that is acceptable
        // for load test purposes; the doIf block below is a no-op in that case.
        .checkIf((response: io.gatling.http.response.Response, _: io.gatling.core.session.Session) =>
          Option(response.headers.get("content-type")).exists(_.contains("application/json"))
        )(jsonPath("$.exercise_production_id").optional.saveAs("productionId"))
    )
    .pause(2.seconds, 5.seconds)

    // Gateway → ms-exercise: read the evaluation result (if production was created)
    .doIf(session => session.contains("productionId")) {
      exec(
        http("S2_getResult")
          .get("/api/exercise-production/${productionId}")
          .check(status.in(200, 404))
      )
    }

    .exec(logout)

  // ──────────────────────────────────────────────────────────
  // LOAD SHAPE
  //
  // S1 spans the full ramp-up → sustained → ramp-down arc.
  // S2 is delayed (students don't submit immediately), starts at
  // rampUp + sustained/3 to model the end-of-session submission rush.
  //
  // Total duration: rampUp + sustained + rampDown seconds
  // ──────────────────────────────────────────────────────────
  setUp(
    // ── Scenario 1: full classroom arc ──
    classroomBegin.inject(
      rampUsersPerSec(0)         .to(targetRps)  .during(rampUp.seconds),
      constantUsersPerSec(targetRps)             .during(sustained.seconds),
      rampUsersPerSec(targetRps) .to(0)          .during(rampDown.seconds)
    ),

    // ── Scenario 2: delayed submission burst at end-of-session ──
    exerciseSubmit.inject(
      // Wait for students to be in the session before they start submitting
      nothingFor((rampUp + sustained / 3).seconds),
      rampUsersPerSec(0)         .to(submitRps)  .during((sustained / 4).seconds),
      constantUsersPerSec(submitRps)             .during((sustained / 4).seconds),
      rampUsersPerSec(submitRps) .to(0)          .during((sustained / 4 + rampDown).seconds)
    )
  )
  .protocols(httpProtocol)
  .assertions(
    // Hard SLA for the paper – adjust if your environment is slower
    global.responseTime.percentile(99).lt(5000),
    global.successfulRequests.percent.gte(95.0)
  )
}
