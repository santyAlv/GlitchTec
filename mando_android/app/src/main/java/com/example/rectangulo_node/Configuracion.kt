package com.example.rectangulo_node

object Configuracion {

    var ip="10.0.2.2"   // el emulador ve la PC en 10.0.2.2; con un celular real, la IP de la PC
    var puerto="3000"

    fun direccion(): String{
        return "$ip:$puerto"
    }
}