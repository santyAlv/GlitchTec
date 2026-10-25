package com.example.rectangulo_node

import android.content.Intent
import android.os.Bundle
import androidx.activity.enableEdgeToEdge
import androidx.appcompat.app.AppCompatActivity
import android.widget.Button
import android.widget.EditText
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat

class Inicio : AppCompatActivity() {

    lateinit var etIp: EditText
    lateinit var etPuerto: EditText

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContentView(R.layout.activity_inicio)
        etIp=findViewById(R.id.etIp)
        etPuerto=findViewById(R.id.etPuerto)
        val botonAnalogico=findViewById<Button>(R.id.btnAnalogico)
        val botonDigital=findViewById<Button>(R.id.btnDigital)
        botonDigital.setOnClickListener {  irDigital()}
botonAnalogico.setOnClickListener { irAnalogico() }

        ViewCompat.setOnApplyWindowInsetsListener(findViewById(R.id.inicio)) { v, insets ->
            val systemBars = insets.getInsets(WindowInsetsCompat.Type.systemBars())
            v.setPadding(systemBars.left, systemBars.top, systemBars.right, systemBars.bottom)
            insets
        }
    }
    fun irDigital(){
        cargaConfig()
        val mandoDigital= Intent(this, MainActivity::class.java)
        startActivity(mandoDigital)
    }
    fun irAnalogico(){
    cargaConfig()
        val mandoAnalogico= Intent(this,Analogico::class.java)
        startActivity(mandoAnalogico)
    }
    fun cargaConfig() {

        if (etIp.text.isNotEmpty()) {
            Configuracion.ip = etIp.text.toString()
        }

        if (etPuerto.text.isNotEmpty()) {
            Configuracion.puerto = etPuerto.text.toString()
        }
    }
}