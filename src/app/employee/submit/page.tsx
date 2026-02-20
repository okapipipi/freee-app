import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Building2, Wallet } from "lucide-react";

export default function SubmitChoicePage() {
  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">申請の種類を選択</h1>
        <p className="mt-1 text-sm text-gray-500">
          申請する費用の種類に応じて選択してください
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* 販管費 */}
        <Link href="/employee/submit/sga">
          <Card className="cursor-pointer hover:shadow-md hover:border-blue-300 transition-all h-full">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <div className="rounded-lg bg-blue-50 p-2">
                  <Building2 className="h-5 w-5 text-blue-600" />
                </div>
                <CardTitle className="text-base">販管費申請</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              <CardDescription className="text-xs leading-relaxed">
                会社が負担する費用の申請です。
                銀行振込・会社カード（黒AMEX・会社AMEX・UPSIDER）での支払いはこちらです。
              </CardDescription>
              <ul className="text-xs text-gray-500 space-y-0.5 list-disc list-inside">
                <li>銀行振込での支払い（請求書払い等）</li>
                <li>採用ツールなどのクラウドサービス</li>
                <li>Salesforce等の年間費用</li>
                <li>外注費・業務委託費</li>
              </ul>
            </CardContent>
          </Card>
        </Link>

        {/* 立替経費 */}
        <Link href="/employee/submit/expense">
          <Card className="cursor-pointer hover:shadow-md hover:border-green-300 transition-all h-full">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <div className="rounded-lg bg-green-50 p-2">
                  <Wallet className="h-5 w-5 text-green-600" />
                </div>
                <CardTitle className="text-base">立替経費申請</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              <CardDescription className="text-xs leading-relaxed">
                自身が立替払いした費用の申請です。
              </CardDescription>
              <ul className="text-xs text-gray-500 space-y-0.5 list-disc list-inside">
                <li>移動交通費（立替）※通勤費は対象外</li>
                <li>社内・会食の飲食費（立替）</li>
              </ul>
            </CardContent>
          </Card>
        </Link>
      </div>

      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800 space-y-1">
        <p className="font-medium">会社カードをお使いの方へ</p>
        <p>
          黒AMEX（安達）・会社AMEX・UPSIDERでの支払いは会社負担のため、
          <strong>「立替経費」ではなく「販管費」で申請</strong>してください。
        </p>
        <p>
          立替経費の<strong>交通費は移動交通費のみ</strong>が対象です。通勤交通費は対象外です。
        </p>
      </div>
    </div>
  );
}
