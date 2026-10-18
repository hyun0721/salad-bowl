package com.saladbowl.api.importer;

import com.saladbowl.api.transaction.TransactionData;

/** 엑셀 한 행. rowNumber는 엑셀 화면의 1부터 시작하는 행 번호다(헤더가 1행). */
public record ParsedRow(int rowNumber, TransactionData data) {
}
