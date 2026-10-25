package com.example.rectangulo_node

import android.os.Bundle
import android.widget.Button
import android.widget.Toast
import androidx.activity.enableEdgeToEdge
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat

import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.WebSocket
import okhttp3.WebSocketListener

class MainActivity : AppCompatActivity() {

    private lateinit var webSocket: WebSocket



    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContentView(R.layout.activity_main)


        // Botones
        val btnUp: Button = findViewById(R.id.btnUp)
        val btnDown: Button = findViewById(R.id.btnDown)
        val btnLeft: Button = findViewById(R.id.btnLeft)
        val btnRight: Button = findViewById(R.id.btnRight)

        // Conexión WebSocket
        val client = OkHttpClient()
        val request = Request.Builder().url("ws://"+Configuracion.direccion()).build()
        webSocket = client.newWebSocket(request, object : WebSocketListener() {
            override fun onOpen(webSocket: WebSocket, response: okhttp3.Response) {
                super.onOpen(webSocket, response)
                runOnUiThread {
                    Toast.makeText(this@MainActivity, "Conectado al servidor", Toast.LENGTH_SHORT).show()
                }
            }

            override fun onMessage(webSocket: WebSocket, text: String) {
                super.onMessage(webSocket, text)
                println("Mensaje recibido desde servidor: $text")
            }

            override fun onFailure(webSocket: WebSocket, t: Throwable, response: okhttp3.Response?) {
                super.onFailure(webSocket, t, response)
                t.printStackTrace()
            }
        })


        btnUp.setOnClickListener { sendCommand("UP") }
        btnDown.setOnClickListener { sendCommand("DOWN") }
        btnLeft.setOnClickListener { sendCommand("LEFT") }
        btnRight.setOnClickListener { sendCommand("RIGHT") }




        ViewCompat.setOnApplyWindowInsetsListener(findViewById(R.id.main)) { v, insets ->
            val systemBars = insets.getInsets(WindowInsetsCompat.Type.systemBars())
            v.setPadding(systemBars.left, systemBars.top, systemBars.right, systemBars.bottom)
            insets
        }
    }

    private fun sendCommand(command: String) {
        val json = """{"action":"$command"}"""
        webSocket.send(json)
    }
}