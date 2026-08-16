import React from 'react'
import Navbar from '../components/Navbar/Navbar'
import { useState } from "react";
import { Button } from "antd";
const Recipes = () => {
  const [message, setMessage] = useState("Scan your RFID");

  const connectArduino = async () => {
    try {
      const port = await navigator.serial.requestPort();

      await port.open({
        baudRate: 9600,
      });

      const reader = port.readable
        .pipeThrough(new TextDecoderStream())
        .getReader();

      while (true) {
        const { value, done } = await reader.read();

        if (done) break;

        if (value) {
          const uid = value.trim().toUpperCase();

          console.log("RFID:", uid);

          if (uid === "E0 6E 47 13") {
            setMessage("Hello Maverick!");
          } 
          else if (uid === "02 39 B1 FC 24 E0 20") {
            setMessage("Hello Thrixia!");
          } 
          else {
            setMessage("Unknown RFID");
          }
        }
      }
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        flexDirection: "column",
        gap: "30px",
      }}
    >
      <h1>{message}</h1>

      <Button
        type="primary"
        size="large"
        onClick={connectArduino}
      >
        Connect RFID
      </Button>
    </div>
  );
}

export default Recipes
