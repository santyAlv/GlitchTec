package com.example.rectangulo_node

import android.content.Intent
import android.os.Bundle
import androidx.activity.enableEdgeToEdge
import androidx.appcompat.app.AppCompatActivity
import android.view.View
import android.widget.EditText
import android.widget.Toast
import com.google.mlkit.vision.barcode.common.Barcode
import com.google.mlkit.vision.codescanner.GmsBarcodeScannerOptions
import com.google.mlkit.vision.codescanner.GmsBarcodeScanning
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
        findViewById<View>(R.id.btnAnalogico).setOnClickListener { irAnalogico() }
        findViewById<View>(R.id.btnQr).setOnClickListener { escanearQr() }

        ViewCompat.setOnApplyWindowInsetsListener(findViewById(R.id.inicio)) { v, insets ->
            val systemBars = insets.getInsets(WindowInsetsCompat.Type.systemBars())
            v.setPadding(systemBars.left, systemBars.top, systemBars.right, systemBars.bottom)
            insets
        }
    }
    // El relay muestra un QR con "IP:PUERTO"; al leerlo se llena la config y se entra al mando
    fun escanearQr() {
        val opciones = GmsBarcodeScannerOptions.Builder().setBarcodeFormats(Barcode.FORMAT_QR_CODE).build()
        GmsBarcodeScanning.getClient(this, opciones).startScan()
            .addOnSuccessListener { codigo ->
                val partes = codigo.rawValue?.split(":")
                if (partes?.size == 2 && partes[1].toIntOrNull() != null) {
                    etIp.setText(partes[0])
                    etPuerto.setText(partes[1])
                    irAnalogico()
                } else {
                    Toast.makeText(this, "QR no valido", Toast.LENGTH_SHORT).show()
                }
            }
            .addOnFailureListener { Toast.makeText(this, "No se pudo escanear: ${it.message}", Toast.LENGTH_LONG).show() }
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