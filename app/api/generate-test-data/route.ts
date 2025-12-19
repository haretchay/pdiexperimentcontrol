import { NextResponse } from "next/server"

// This is a placeholder API route for generating test data
// In a real application, this would connect to a database and create sample records

export async function POST() {
  try {
    // Simulate database operations with a delay
    await new Promise((resolve) => setTimeout(resolve, 1000))

    // In a real app, this would create test data in the database
    // For now, we'll just return a success response

    return NextResponse.json({
      success: true,
      message: "Test data generated successfully",
      data: {
        experiments: 5,
        tests: 25,
        repetitions: 15,
      },
    })
  } catch (error) {
    console.error("Error generating test data:", error)
    return NextResponse.json({ success: false, message: "Failed to generate test data" }, { status: 500 })
  }
}
