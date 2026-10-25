package com.example.rectangulo_node

import android.annotation.SuppressLint
import android.os.Bundle
import android.view.MotionEvent
import android.view.View
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import kotlin.math.hypot

class Analogico : AppCompatActivity() {

    private lateinit var webSocket: WebSocket

    @SuppressLint("ClickableViewAccessibility")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_analogico)

        val base = findViewById<View>(R.id.joystick_base)
        val knob = findViewById<View>(R.id.joystick_knob)

        // -------------------------
        // WEBSOCKET
        // -------------------------

        val client = OkHttpClient()

        val request = Request.Builder()
            .url("ws://" + Configuracion.direccion())
            .build()

        webSocket = client.newWebSocket(
            request,
            object : WebSocketListener() {

                override fun onOpen(
                    webSocket: WebSocket,
                    response: okhttp3.Response
                ) {
                    runOnUiThread {
                        Toast.makeText(
                            this@Analogico,
                            "Conectado al servidor",
                            Toast.LENGTH_SHORT
                        ).show()
                    }
                }
            }
        )

        // Botones de clic: apretado al tocar, soltado al levantar el dedo
        botonClic(R.id.btnIzq, "left")
        botonClic(R.id.btnDer, "right")

        // Armado del mando
        base.post {

            val baseRadius = base.width / 2f
            val knobRadius = knob.width / 2f

            // Distancia máxima que puede recorrer el centro del knob
            val maxDistance = baseRadius - knobRadius

            // Obtenemos la posición REAL de la base en la pantalla.
            // Así podemos comparar correctamente con rawX/rawY.
            val location = IntArray(2)
            base.getLocationOnScreen(location)

            val centerXScreen = location[0] + base.width / 2f
            val centerYScreen = location[1] + base.height / 2f

            // Posición del centro dentro del padre.
            // Esta se usa solamente para dibujar el knob.
            val centerX = base.x + base.width / 2f
            val centerY = base.y + base.height / 2f

            knob.setOnTouchListener { _, event ->

                when (event.action) {

                    MotionEvent.ACTION_MOVE -> {

                        // Distancia entre el dedo y el centro
                        val dx = event.rawX - centerXScreen
                        val dy = event.rawY - centerYScreen

                        val distance = hypot(dx, dy)

                        // -------------------------
                        // LIMITAR AL CÍRCULO
                        // -------------------------

                        val ratio = if (distance > maxDistance) {
                            maxDistance / distance
                        } else {
                            1f
                        }

                        val constrainedX = dx * ratio
                        val constrainedY = dy * ratio

                        // -------------------------
                        // MOVER EL KNOB
                        // -------------------------

                        knob.x =
                            centerX + constrainedX - knob.width / 2f

                        knob.y =
                            centerY + constrainedY - knob.height / 2f

                        // -------------------------
                        // NORMALIZAR -1 A 1
                        // -------------------------

                        val xValue =
                            constrainedX / maxDistance

                        val yValue =
                            -(constrainedY / maxDistance)

                        sendAnalogCommand(xValue, yValue)
                    }

                    MotionEvent.ACTION_UP,
                    MotionEvent.ACTION_CANCEL -> {

                        // Volver suavemente al centro
                        knob.animate()
                            .x(centerX - knob.width / 2f)
                            .y(centerY - knob.height / 2f)
                            .setDuration(100)
                            .start()

                        sendAnalogCommand(0f, 0f)
                    }
                }

                true
            }
        }
    }
//funcion para pasar los datos
    private fun sendAnalogCommand(x: Float, y: Float) {

        val json = """{"x":$x,"y":$y}"""

        webSocket.send(json)
    }

    // Manda {"button":"left"|"right","down":true|false}, lo que lee js/input.js del juego
    @SuppressLint("ClickableViewAccessibility")
    private fun botonClic(id: Int, lado: String) {
        findViewById<View>(id).setOnTouchListener { _, event ->
            when (event.action) {
                MotionEvent.ACTION_DOWN ->
                    webSocket.send("""{"button":"$lado","down":true}""")
                MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL ->
                    webSocket.send("""{"button":"$lado","down":false}""")
            }
            true
        }
    }

    override fun onDestroy() {
        webSocket.close(1000, null)
        super.onDestroy()
    }
}