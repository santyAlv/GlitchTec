package com.example.rectangulo_node

object Configuracion {

    var ip="192.168.1.38"
    var puerto="3000"

    fun direccion(): String{
        return "$ip:$puerto"
    }
}