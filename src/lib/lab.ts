export interface LabMetric {
    label: string
    score: number // 1-10
    comment: string
}

export interface LabReport {
    id: string
    pros: string[]
    cons: string[]
    metrics: {
        spineAlignment: LabMetric
        heatDissipation: LabMetric
        motionTransfer: LabMetric
        pressureRelief: LabMetric
    }
    testerName: string
    testDate: string
}
