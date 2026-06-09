package ob

import io.gatling.core.Predef._
import io.gatling.http.Predef._
import scala.concurrent.duration._

class ObSimulation extends Simulation {

  val baseUrl  = System.getProperty("baseUrl",  "http://localhost:8080")
  val rps      = System.getProperty("rps",      "5").toInt
  val rampUp   = System.getProperty("rampUp",   "60").toInt
  val duration = System.getProperty("duration", "300").toInt

  val httpProtocol = http
    .baseUrl(baseUrl)
    .acceptHeader("application/json, text/html, */*")
    .disableFollowRedirect

  // ── Auth helper ──────────────────────────────────────────────────────────
  // For variants with ZT_AUTH=true the gateway requires a JWT.
  // For baseline (ZT_AUTH=false) the /zt/login call is a no-op (returns 404
  // from the OB frontend), so we guard with a check that accepts both 200 and
  // 404 to keep the flow portable.

  val login = exec { session =>
    // Each VU gets a unique userId so the RA rate-limit (per-user RPM cap)
    // is not shared across the whole virtual user pool.
    session.set("userId", s"perf-${session.userId}")
  }.exec(
    http("login")
      .post("/zt/login")
      .header("Content-Type", "application/json")
      .body(StringBody("""{"userId":"${userId}"}"""))
      .check(status.in(200, 404))
      .check(
        jsonPath("$.token").optional.saveAs("jwtToken")
      )
  ).exec { session =>
    if (session("jwtToken").asOption[String].isEmpty)
      session.set("jwtToken", "")
    else session
  }

  // ── Browse scenario ──────────────────────────────────────────────────────
  val browse = exec(
    http("home")
      .get("/")
      .header("Authorization", "Bearer ${jwtToken}")
      .check(status.is(200))
  ).pause(1)
  .exec(
    http("product")
      .get("/product/OLJCESPC7Z")
      .header("Authorization", "Bearer ${jwtToken}")
      .check(status.is(200))
  ).pause(1)
  .exec(
    http("add_to_cart")
      .post("/cart")
      .header("Authorization", "Bearer ${jwtToken}")
      .formParam("product_id", "OLJCESPC7Z")
      .formParam("quantity", "1")
      .check(status.in(200, 302))
  ).pause(1)
  .exec(
    http("cart")
      .get("/cart")
      .header("Authorization", "Bearer ${jwtToken}")
      .check(status.in(200, 302))
  ).pause(1)
  .exec(
    http("checkout")
      .post("/cart/checkout")
      .header("Authorization", "Bearer ${jwtToken}")
      .formParam("email", "perf@test.com")
      .formParam("street_address", "1 Test St")
      .formParam("zip_code", "10001")
      .formParam("city", "New York")
      .formParam("state", "NY")
      .formParam("country", "United States")
      .formParam("credit_card_number", "4432801561520454")
      .formParam("credit_card_expiration_month", "12")
      .formParam("credit_card_expiration_year", "2030")
      .formParam("credit_card_cvv", "672")
      .check(status.in(200, 302))
  )

  val scn = scenario("Browse-and-Checkout")
    .exec(login)
    .exec(browse)

  setUp(
    scn.inject(
      rampUsersPerSec(0) to rps during (rampUp.seconds),
      constantUsersPerSec(rps) during (duration.seconds)
    )
  ).protocols(httpProtocol)
   .assertions(
     global.failedRequests.percent.lt(5),
     global.responseTime.percentile(99).lt(5000)
   )
}
